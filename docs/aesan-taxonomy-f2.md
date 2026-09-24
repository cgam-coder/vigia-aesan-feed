# AESAN-TAXONOMY-F2: productor local, pendiente de activación

Base exacta: `18901187dade534d151fbd4d4d08d43dd63ce586`. Consumidor F1: runtime `9a058af60d3f2737856ee869034e7698239078a3`, con interfaz pública apagada. Este candidato no incluye `feed.json` ni cambios de workflow.

## Autoridad y algoritmo

Cada ejecución verifica los tres enlaces de la portada y las tres opciones exactas del selector. Después recorre las páginas declaradas por los tres filtros oficiales, comprueba rango, total, número de tarjetas y continuación de paginación, y deduplica por URL oficial. La clasificación no usa `categoryFor`, título, icono, producto, cuerpo ni referencia visible. Para cada publicación conservada en el feed comprueba el `idAlert` de su página oficial contra la URL e identidad preservadas. Antes de cualquier escritura bloquea fallos de transporte, cambios de controles/UUID/label, páginas incompletas, duplicidad entre categorías, conflictos de identidad y reclasificación de una publicación acreditada en F0 o en el feed previo. Las ausencias acreditadas tras un barrido completo se emiten como `unknown` y se informan; una URL filtrada fuera del historial se informa como gap y no se inserta.

El objeto `aesanAlertClassification` es enriquecimiento. `assembleFeed` conserva sus reglas de identidad, hashes y fechas; se aplica el enriquecimiento después. Si la firma final coincide con la del feed anterior, se reutilizan sus bytes lógicos, incluido `generatedAt`. La escritura usa archivo temporal y sustitución atómica en la misma ruta. El código existente de `categoryFor`, `scopeFor`, `productClassFor`, `inferHazard` y prioridad permanece intacto.

## Evidencia reproducible

- F0: `test/fixtures/aesan-taxonomy-f0-reviewed.json`, derivado de los anexos del issue runtime #88, comentarios `5814188646` y `5814190036`; 166 URL + idAlert preservados, de los cuales 165 tienen clase oficial. SHA-256 de fixture: `46da2715536682075efabfee11cc535b566746254a9dcb9853ba5fe8bd96c210`.
- F2: captura pública AESAN de solo lectura, 24-09-2026: `test/fixtures/aesan-taxonomy-f2-capture.json`. Conserva el fragmento mínimo para repetir el parser de portada, selector y 60 páginas filtradas, junto con URL, tamaño y SHA-256 del cuerpo HTML original y SHA-256 de cada fragmento. SHA-256 del fixture completo: `e551f8704595d84187e9c18b002457705aa1b978f73bdae7b5c10380ee2c82fc`. Los cuerpos HTML completos se usaron para la captura; el fixture compacto evita incluir navegación y contenido ajeno al barrido.
- Páginas filtradas: general 30, alergias 25, complementos 5. Tarjetas brutas 581 / 497 / 98. URL distintas 83 / 71 / 14; total 168 URL. No hay URL en dos categorías.
- Corpus del feed fijo: 127 alertas, 166 publicaciones preservadas, 165 con clase y una sin ella. Proyección: 59 general, 53 alergias, 14 complementos, 1 unknown, 0 conflict. La única unknown es la publicación actual `/alertas/2026_52_Ampliacion_1` de ES2026/382; la anterior `/alertas/2026_52` conserva su match de alergias.
- Gaps fuera del historial: `/alertas/2025_05`, `/alertas/2025_13`, `/alertas/2025_13_Amp`. No se añadieron al feed.
- ES2026/266: `allergy_intolerance_adverse` y `productClass = Complementos alimenticios`. ES2026/085: dos publicaciones de alergias. ES2026/177: tres de interés general. ES2026/517: dos de alergias.

## Verificaciones locales

`npm test`: 234/234 PASS en Node 24; incluye replay íntegro del fixture F2, fixture F0, drift, conflict, URL↔UUID, pérdida de página y prueba de bytes intactos cuando falla el scan. La prueba histórica de diferencial inicialmente fallaba también en la base exacta por comparar `publicationSelection` como campo corriente; se corrigió únicamente esa comparación de ledger, conservando la comparación de todos los demás campos. `node --check` de ambos scripts y `git diff --check`: PASS. No hay script de lint en `package.json`.

El replay de las 127 alertas conserva cada objeto anterior al quitar únicamente `aesanAlertClassification`. El parser y el normalizador reales del runtime F1 aceptaron las 127 alertas enriquecidas y trasladaron la clasificación a `canonical.sourceRecord`. Un segundo enriquecimiento con el mismo corpus es idéntico. Tamaño pretty JSON: 2.142.370 → 2.272.138 bytes; incremento 129.768 bytes (+6,057 %); máximo objeto individual de taxonomía en JSON compacto: 3.080 bytes.

## Límite operativo

El commit permanece local. Un push a `main` de `scripts/**` o `test/**` activa el workflow existente, que genera y publica `feed.json` y solicita ingestión. F3 debe decidir el momento de integración y volver a contrastar las superficies oficiales y el corpus en ese instante. Antes de habilitar la interfaz pública, F3 debe realizar la matriz visual pendiente con el gate activado. Los tres gaps de historial y la causa de la ausencia de clasificación de ES2026/382 siguen sin resolverse.
