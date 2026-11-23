# Accesibilidad de la app móvil

Características de accesibilidad de `apps/mobile`. Casi toda la interacción está en los componentes compartidos de `src/shared/ui`, así que cada mejora aplica a toda la app. El criterio de referencia es WCAG 2.1 AA, junto con las guías de Android (48 dp) e iOS (44 pt).

## 1. Lectores de pantalla (TalkBack y VoiceOver)

| Característica | Dónde |
| :--- | :--- |
| Roles y estados en todos los controles interactivos (`button`, `checkbox`, `switch`, `tab`, `radio`, `radiogroup`, `header`, `alert`) | `shared/ui/*` |
| Los botones informan `disabled` y `busy`. Mientras cargan, conservan el título como etiqueta | `Button.tsx` |
| `IconButton` exige una etiqueta (`label`), así que ningún botón de solo ícono queda sin nombre | `IconButton.tsx` |
| Los íconos decorativos se ocultan al lector. Solo se leen si tienen `accessibilityLabel` | `Icon.tsx` |
| Los campos de selección y de fecha exponen etiqueta, valor actual y una pista ("Obligatorio" más el mensaje de error) | `FieldFrame.tsx`, `SelectField.tsx`, `DateField/` |
| Los campos de texto y las casillas anuncian si son obligatorios y su error con `accessibilityHint` | `TextField.tsx`, `CheckboxField.tsx` |
| `Switch` acepta una etiqueta (`label`) | `Switch.tsx` |
| Chips, listas de opciones y opciones de selección son radios (estado `checked`) dentro de un `radiogroup` | `ChipSelector.tsx`, `OptionList.tsx`, `SelectField.tsx` |
| Los títulos de pantalla y de sección tienen rol `header`, para saltar entre secciones | `AppText.tsx` (variantes `screenTitle` y `sectionTitle`) |
| Los avisos se anuncian al aparecer: región viva asertiva con rol `alert` para errores y educada para el resto. En iOS se llama a `announceForAccessibility` | `Banner.tsx` |
| Cada tarjeta de prestador se lee como un solo elemento | `ProviderSummary.tsx` |
| Los marcadores del mapa tienen como etiqueta el nombre del prestador | `PinMap.tsx` |
| Los días del calendario se leen con la fecha completa, en el idioma de la app | `DateField/MonthGrid.tsx` |
| La foto a pantalla completa tiene descripción ("Foto 1"). El indicador de carga se lee una sola vez | `PhotoPreviewScreen`, `LoadingState.tsx` |

### Alternativa al mapa

La pantalla de asistencia cercana tiene un selector **Mapa / Lista** y abre en el mapa. La lista muestra los prestadores del más cercano al más lejano, con nombre, categoría, distancia, llegada estimada y calificación, de modo que se pueden consultar sin recorrer los marcadores. Ver `features/providers/components/ProviderList.tsx`.

## 2. Contraste de color

Los colores están en `shared/theme/colors.ts`. Relaciones de contraste calculadas con la fórmula de WCAG:

| Par | Relación | Mínimo |
| :--- | :--- | :--- |
| Texto principal sobre fondo | 14,2 | 4,5 |
| Texto atenuado sobre blanco | 5,6 | 4,5 |
| Blanco sobre `navy` | 11,6 | 4,5 |
| Blanco sobre `teal` (botón de acento, chip pagado) | 4,9 | 4,5 |
| Blanco sobre `danger` (botón de peligro) | 5,4 | 4,5 |
| Texto de error (`danger`) sobre blanco | 5,8 | 4,5 |
| Contornos de campos, casillas e interruptor (`borderStrong`) | 3,5 | 3,0 |
| Texto de cada aviso sobre su fondo (éxito, información, advertencia, error) | 4,4 a 6,9 | 4,5 |

Los avisos combinan color, texto e ícono, y las etiquetas de estado llevan texto, así que el color nunca es el único medio de información.

## 3. Tamaño de los elementos táctiles

- Botones, filas de casilla y filas de opciones: al menos 44 de alto.
- `IconButton`: área táctil de 44 x 44.
- Interruptor y chips: `hitSlop` adicional para llegar a 44.
- Celdas del calendario (días y años): 44 de alto.

## 4. Texto grande y escalado de fuente

- La app no limita el escalado de fuente del sistema.
- Los títulos de cabecera pueden ocupar dos líneas.
- Las celdas del calendario y sus cuadrículas crecen con el texto en lugar de tener alturas fijas.
- El texto de las fichas de evidencia es de 12.

## 5. Reducción de movimiento

`shared/ui/motion.ts` lee el ajuste "reducir movimiento" del sistema y escucha sus cambios. Con el ajuste activo, las animaciones de pulsación, selección, interruptor, enfoque de campo y barra de pestañas son instantáneas. Toda animación nueva debe tomar su duración de `motionDuration(ms)`.

## 6. Idioma

Los textos están en español e inglés (`texts/es.ts` y `texts/en.ts` por funcionalidad). Las etiquetas de accesibilidad salen de esos mismos archivos.

## 7. Pruebas

- Las pruebas unitarias consultan los elementos por rol y etiqueta, y verifican sus estados (`checked`, `disabled`).
- Para ejecutarlas se necesita `apps/mobile/.env` (copia de `.env.example`).

## 8. Revisión estática

La configuración de ESLint usa `eslint-plugin-jsx-a11y`, que revisa solo código web. El siguiente paso, de baja prioridad, es agregar `eslint-plugin-react-native-a11y` a la configuración de ESLint de la app móvil.
