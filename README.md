# VIGÍA · conector AESAN

Feed público para VIGÍA generado a partir del [buscador oficial de alertas alimentarias de AESAN](https://www.aesan.gob.es/alertas/buscador-alertas).

## Qué hace

- consulta directamente el listado y las fichas oficiales de `aesan.gob.es`;
- elimina las fichas repetidas que pueda devolver el buscador;
- extrae referencia, fecha, producto, marca, peligro, origen, lotes, distribución, recomendación e imagen;
- conserva siempre el enlace de la ficha oficial de AESAN;
- publica un JSON normalizado que VIGÍA puede consumir sin depender de redes sociales.

El feed se comprueba cada 15 minutos mediante GitHub Actions. Solo se crea un nuevo commit cuando cambia una alerta, para evitar ruido innecesario en el historial.

## Feed

`https://raw.githubusercontent.com/cgam-coder/vigia-aesan-feed/main/feed.json`

## Ejecución local

Requiere Node.js 20 o posterior.

```bash
npm test
npm run update
```

AESAN es la fuente y titular de la información original. Este repositorio únicamente transforma datos públicos para facilitar su consulta; ante cualquier discrepancia prevalece la ficha oficial enlazada en cada alerta.
