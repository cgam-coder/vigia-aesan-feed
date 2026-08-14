# VIGÍA · conector AESAN

Feed público para VIGÍA generado a partir del [buscador oficial de alertas alimentarias de AESAN](https://www.aesan.gob.es/alertas/buscador-alertas).

## Qué hace

- consulta directamente el listado y las fichas oficiales de `aesan.gob.es`;
- elimina las fichas repetidas que pueda devolver el buscador;
- extrae referencia, fecha, producto, marca, peligro, origen, lotes, distribución, recomendación e imagen;
- conserva el archivo histórico público accesible desde el buscador y el índice histórico heredado de AESAN, sin el límite anterior de 60 registros;
- clasifica el producto y separa marca de operador, fabricante, distribuidor o importador cuando la ficha lo identifica expresamente;
- conserva siempre el enlace de la ficha oficial de AESAN;
- publica un JSON normalizado que VIGÍA puede consumir sin depender de redes sociales.

El feed reciente se comprueba cada 15 minutos mediante GitHub Actions. Una sincronización integral recorre semanalmente todo el histórico público y también se ejecuta al publicar cambios del conector. Solo se identifica un proveedor u operador cuando AESAN lo menciona de forma explícita: una marca no se convierte automáticamente en proveedor.

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
