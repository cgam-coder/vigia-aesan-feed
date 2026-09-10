# VIGÍA · conector AESAN

Feed público para VIGÍA generado a partir del [buscador oficial de alertas alimentarias de AESAN](https://www.aesan.gob.es/alertas/buscador-alertas).

## Qué hace

- consulta directamente el listado y las fichas oficiales de `aesan.gob.es`;
- elimina las fichas repetidas que pueda devolver el buscador;
- extrae referencia, fecha, producto, marca, peligro, origen, lotes, distribución, recomendación e imagen;
- conserva en `notifyingText` la frase oficial que identifica inequívocamente una CCAA notificante, sin convertir menciones de distribución o traslados nacionales genéricos en evidencia notificante;
- conserva el archivo histórico público accesible desde el buscador oficial de AESAN, sin el límite anterior de 60 registros;
- clasifica el producto y separa marca de operador, fabricante, distribuidor o importador cuando la ficha lo identifica expresamente;
- conserva siempre el enlace de la ficha oficial de AESAN;
- identifica cada publicación por el UUID oficial `idAlert` y usa la ruta oficial, con namespace explícito, solo cuando el UUID no está publicado;
- mantiene la referencia visible como metadato mutable y conserva las referencias oficiales anteriores sin duplicar la publicación;
- publica un JSON normalizado que VIGÍA puede consumir sin depender de redes sociales.

El feed reciente se comprueba normalmente cada 15 minutos mediante GitHub Actions. El workflow puede permanecer temporalmente deshabilitado durante una contención operativa. Una sincronización integral recorre semanalmente todo el histórico público y también se ejecuta al publicar cambios del conector. Solo se identifica un proveedor u operador cuando AESAN lo menciona de forma explícita: una marca no se convierte automáticamente en proveedor.

`sourceRecordId` es la autoridad de merge. `id` conserva la identidad interna de primera observación, `reference` contiene la referencia oficial vigente, `previousReferences` mantiene sus alias históricos y `referenceHistory` conserva los estados semánticos anteriores. Repetir el mismo contenido no cambia `updatedAt`, `versionCount`, `contentHash` ni `generatedAt`.

> Alcance: este repositorio archiva las alertas que AESAN publica para consulta pública. No representa todas las notificaciones internas gestionadas mediante SCIRI, ya que AESAN no publica necesariamente cada notificación recibida.

## Feed

`https://raw.githubusercontent.com/cgam-coder/vigia-aesan-feed/main/feed.json`

## Ejecución local

Requiere Node.js 20 o posterior.

```bash
npm test
npm run update
```

AESAN es la fuente y titular de la información original. Este repositorio únicamente transforma datos públicos para facilitar su consulta; ante cualquier discrepancia prevalece la ficha oficial enlazada en cada alerta.
