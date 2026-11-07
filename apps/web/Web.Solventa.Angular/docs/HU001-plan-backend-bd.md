# HU001 — Plan de Backend y Base de Datos (4 Ramos)

**Historia de Usuario:** Diligenciar formulario dinámico de cotización por ramo  
**Ramos del Alcance:** Viajes, Microseguros, Vida Hipotecario y Paramétrico.

---

## 1. Modelos de Solicitud en Backend (`rating/domain/models.py`)

Se implementan 4 modelos específicos para los 4 ramos de la HU:

```python
from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, model_validator


# 1. VIAJES (Existente)
class SolicitudCotizacionViaje(BaseModel):
    producto_id: str = "viaje-internacional"
    destino: Literal["Estados Unidos", "España", "México", "Otro país"]
    fecha_salida: date
    fecha_regreso: date
    viajeros: int = Field(ge=1)
    fecha_nacimiento: date | None = None

    @model_validator(mode="after")
    def _regreso_posterior_a_salida(self) -> "SolicitudCotizacionViaje":
        if self.fecha_regreso <= self.fecha_salida:
            raise ValueError("La fecha de regreso debe ser posterior a la fecha de salida")
        return self


# 2. MICROSEGUROS (Nuevo)
class SolicitudCotizacionMicroseguroVida(BaseModel):
    producto_id: str = "vida-esencial"
    fecha_nacimiento: date
    suma_asegurada: Decimal = Field(gt=0)
    beneficiario: str
    parentesco: Literal["Cónyuge", "Hijo(a)", "Padre / Madre", "Otro"]


# 3. VIDA HIPOTECARIO (Nuevo - Producto Insignia)
class SolicitudCotizacionVidaHipotecario(BaseModel):
    producto_id: str = "vida-hipotecario"
    fecha_nacimiento: date
    entidad: str
    valor_credito: Decimal = Field(gt=0)
    plazo_anios: int = Field(ge=1)


# 4. PARAMÉTRICO (Nuevo)
class SolicitudCotizacionParametrico(BaseModel):
    producto_id: str = "parametrico-clima-vuelo"
    evento: Literal["Retraso de vuelo", "Lluvia excesiva"]
    referencia: str
    fecha_evento: date
    valor_indemnizar: Decimal = Field(gt=0)


# Discriminador unificado de rating
SolicitudRating = (
    SolicitudCotizacionViaje
    | SolicitudCotizacionMicroseguroVida
    | SolicitudCotizacionVidaHipotecario
    | SolicitudCotizacionParametrico
    | SolicitudCotizacion  # Fallback genérico
)
```

---

## 2. Motor de Tarifas y Reglas Actuariales (`rating/domain/rating.py`)

Fórmulas determinísticas para cada uno de los 4 ramos:

1. **Viajes (`viaje-internacional`):**
   $$	ext{Prima} = 	ext{Tarifa diaria (\$9.000)} 	imes 	ext{Días} 	imes 	ext{Viajeros} 	imes 1.19$$
2. **Microseguro de Vida (`vida-esencial`):**
   $$	ext{Prima} = rac{	ext{Suma asegurada}}{1.000} 	imes 	ext{Tasa (\$1.2)} 	imes 	ext{Factor edad}$$
3. **Vida Hipotecario (`vida-hipotecario`):**
   $$	ext{Prima} = rac{	ext{Valor crédito}}{1.000} 	imes 	ext{Tasa anual (\$0.8)} 	imes 	ext{Factor edad} 	imes 	ext{Plazo (años)}$$
4. **Paramétrico (`parametrico-clima-vuelo`):**
   $$	ext{Prima} = egin{cases} \$45.000 & 	ext{si Retraso de vuelo} \ \$60.000 & 	ext{si Lluvia excesiva} \end{cases}$$

---

## 3. Vigencias por Ramo en Consenso (`consenso/domain/use_cases.py`)

Ajuste en `_vigencia_propuesta(solicitud)`:
* **Viajes:** Vigencia exactamente igual al periodo del viaje (`desde=fecha_salida`, `hasta=fecha_regreso`).
* **Paramétrico:** Vigencia de cobertura en la `fecha_evento`.
* **Vida Hipotecario:** Vigencia por los años del crédito (`desde=hoy`, `hasta=hoy + plazo_anios`).
* **Microseguros:** Vigencia anual (365 días).

---

## 4. Persistencia en Base de Datos PostgreSQL (`cotizacion`)

Extensión de la tabla `cotizaciones` en `cotizacion_repository.py`:
```sql
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS datos_riesgo JSONB,
  ADD COLUMN IF NOT EXISTS canal VARCHAR(16) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS creada_en TIMESTAMPTZ DEFAULT NOW();
```

El método `save()` persiste el snapshot del riesgo para consulta posterior de la cotización.
