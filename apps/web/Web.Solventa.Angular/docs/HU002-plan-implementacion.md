# HU002 — Plan de Implementación y Guía de Verificación: Consentimiento Digital Open Finance / Open Data

> **Sprint:** Sprint 2 · **Feature:** KAN-2 · **Épica:** KAN-1  
> **Rama:** `jflorez-sprint2`  
> **Fecha:** 2026-10-20  
> **Estado:** Implementado y Verificado (100% Tests Green)

---

## 1. Resumen de la Historia de Usuario

**Como:** Asesor comercial  
**Quiero:** Que el sistema me permita enviar y registrar el consentimiento digital del cliente  
**Para:** Habilitar la consulta legal de sus datos financieros necesarios en el perfilamiento de riesgo.

### Criterios de Aceptación (Cumplidos)

1. **CA-1:** Cuando se solicita el consentimiento, el sistema habilita el envío de un código OTP al celular o correo registrado del cliente.
2. **CA-2:** Cuando el cliente dicta el código y el asesor lo ingresa, el sistema registra en base de datos la fecha, hora y usuario que autoriza, garantizando la trazabilidad.
3. **CA-3:** Cuando se intenta iniciar el cálculo de cotización en seguros de vida hipotecario (o protección de pagos) sin tener el consentimiento validado, el sistema bloquea la acción y muestra una alerta visual.

---

## 2. Componentes Implementados

### Backend — Microservicio `identidad`
- **Dominio KYC:**
  - `identidad.kyc.domain.models`: Modelos `Consentimiento`, `SolicitudConsentimiento`, `RespuestaSolicitud`, `RespuestaValidacion`, `RespuestaConsulta` y excepciones (`CodigoOtpInvalido`, `ConsentimientoExpirado`, `ConsentimientoNoEncontrado`).
  - `identidad.kyc.domain.otp`: Generador OTP de 6 dígitos con `secrets`, hashing SHA-256 y verificación de coincidencia.
  - `identidad.kyc.domain.use_cases`: Casos de uso `SolicitarConsentimiento`, `ValidarConsentimiento`, `ConsultarConsentimiento`.
  - `identidad.kyc.domain.ports`: Protocolo `ConsentimientoRepository`.
- **Adaptadores:**
  - `identidad.kyc.adapters.consentimiento_repository`: `PostgresConsentimientoRepository` (tabla `consentimientos` en PostgreSQL con SQLAlchemy) y `InMemoryConsentimientoRepository` para pruebas aisladas.
- **Inyección y API:**
  - `identidad.container`: Cableado desacoplado en memoria y PostgreSQL.
  - `identidad.kyc.api`: Endpoints `POST /identidad/solicitar`, `POST /identidad/validar`, `GET /identidad/{id}`.
  - `identidad.kyc.bootstrap`: DDL automatizado para inicializar el esquema de consentimientos.

### Backend — BFF Canales (`canales`)
- `canales.clients`: Cliente HTTP con Circuit Breaker hacia `identidad`.
- `canales.web.api`: Rutas proxy para el portal web:
  - `POST /web/consentimientos/solicitar`
  - `POST /web/consentimientos/validar`
  - `GET /web/consentimientos/{consentimiento_id}`

### Frontend — Angular 22
- `src/app/core/constants/api-endpoints.constants.ts`: Mapeo de endpoints de consentimientos.
- `src/app/pages/ops/interfaces/consent.interface.ts`: Interfaces tipadas de solicitud y respuesta.
- `src/app/pages/ops/services/consent.service.ts`: Servicio Angular para solicitar, validar y consultar consentimientos.
- `src/app/pages/ops/components/consent-panel`:
  - Panel dinámico con los 5 estados del mockup:
    1. **Solicitud de consentimiento:** Selección de canal (SMS/Email), alcances configurables (Open Finance, Open Data) y botón de despacho.
    2. **Enviando:** Transición asíncrona.
    3. **Ingreso OTP:** Alerta informativa con demo hint (`Para la demo use XXXXXX`), input numérico de 6 dígitos, botón "Validar código" y "Reenviar".
    4. **Consentimiento validado:** Alerta de éxito y emisión del evento `consentValidated`.
    5. **Registro de trazabilidad:** Grid con `Consentimiento ID`, `Estado`, `Fecha y hora`, `Autorizado ante` (asesor), `Fuente` (canal) y `Alcance`.
- `src/app/pages/ops/components/quote-tab`:
  - Bloqueo visual en el desglose de cotización: *"No es posible cotizar Vida hipotecario sin el consentimiento Open Finance / Open Data validado del cliente."*
  - Botón "Calcular cotización" deshabilitado hasta que `puedeCalcular()` sea verdadero.

---

## 3. Resultados de Pruebas Automatizadas

- **Frontend Angular:** 129 pruebas pasando (24 archivos de test, 0 fallos).
- **Backend Identidad:** 22 pruebas unitarias e integración pasando (0 fallos).
- **Backend Canales:** 59 pruebas pasando (0 fallos).
- **Librería común y suite completa backend:** 100% pasando con 90% de cobertura consolidada.

---

## 4. Guía de Ejecución y Prueba Manual

1. **Levantar backend:**
   ```bash
   cd apps/backend
   docker compose up -d postgres redis localstack cotizacion canales identidad
   ```

2. **Levantar frontend:**
   ```bash
   cd apps/web/Web.Solventa.Angular
   npm run start
   ```
   Abrir [http://localhost:4200](http://localhost:4200).

3. **Flujo de prueba:**
   - Navegar a **Operaciones y Pólizas → Cotización**.
   - Por defecto está seleccionado **Vida hipotecario**.
   - Notar que el botón **"Calcular cotización"** está deshabilitado y en **"Desglose de cotización"** se muestra la alerta de bloqueo roja.
   - En el panel de consentimiento, seleccionar canal (ej. SMS) y alcances, luego hacer clic en **"Solicitar consentimiento (enviar código)"**.
   - Aparece el banner informativo: *"Código enviado al celular \*\*\*4567. Para la demo use: 123456"*.
   - El código se prellena en el campo de texto; hacer clic en **"Validar código"**.
   - Se muestra el banner verde de éxito y la tarjeta de registro con fecha, hora, asesor y alcances.
   - El botón **"Calcular cotización"** se habilita inmediatamente y la alerta de bloqueo desaparece.
   - Hacer clic en **"Calcular cotización"** para verificar el cálculo actuarial.
