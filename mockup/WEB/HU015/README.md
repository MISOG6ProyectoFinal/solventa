# HU015 – API de emisión de póliza

**Canal:** WEB · **Módulo:** Socio → Operaciones del canal → Emitir póliza

Emite con cotización vigente y pago aprobado (número, estado, vigencia y coberturas). Rechaza pago no aprobado o cotización vencida sin crear póliza. Reintentar la misma emisión devuelve la misma póliza sin duplicarla.

## Flujo completo

![Flujo HU015](./flujo.png)

## Paso a paso

### 1. Cotización vigente

![Cotización vigente](./01-cotizacion-vigente.png)

<p align="center">⬇️</p>

### 2. Estado pago aprobado

![Estado pago aprobado](./02-estado-pago-aprobado.png)

<p align="center">⬇️</p>

### 3. Emisión exitosa

![Emisión exitosa](./03-emision-exitosa.png)

<p align="center">⬇️</p>

### 4. Resultado póliza

![Resultado póliza](./04-resultado-poliza.png)

<p align="center">⬇️</p>

### 5. Reintento sin duplicado

![Reintento sin duplicado](./05-reintento-sin-duplicado.png)

<p align="center">⬇️</p>

### 6. Pago rechazado o vencida

![Pago rechazado o vencida](./06-pago-rechazado-o-vencida.png)

<p align="center">⬇️</p>

### 7. Cotización vencida

![Cotización vencida](./07-cotizacion-vencida.png)

---

[← Volver al índice de evidencias](../../README.md)
