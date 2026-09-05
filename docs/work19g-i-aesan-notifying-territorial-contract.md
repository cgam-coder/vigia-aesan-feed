# WORK 19G-I — contrato territorial notificante de AESAN

## Autoridad y alcance

AESAN es la autoridad de la información publicada. Este conector conserva evidencia textual source-derived; no decide la CCAA canónica. `vigia-runtime` continúa siendo la autoridad de canonicalización territorial.

El cambio se limita a añadir `notifyingText` al payload normalizado/canónico del feed AESAN. No cambia referencia, URL oficial, ID, fecha de publicación, item key ni deduplicación. Tampoco reinterpreta `scope`, que continúa conteniendo la evidencia de distribución.

Baseline certificado:

- repositorio: `cgam-coder/vigia-aesan-feed`;
- `main`: `e01e7f92ef27fff4db2f4948f1005470f8c4fde1`;
- árbol: `bdfd45d4881bf5c66c2f4f6895be8eedad11dc2b`;
- branch de trabajo: `work/19g-i-aesan-notifying-territorial-contract`.

## Contrato de extracción

`notifyingText` es una cadena. Contiene una única frase oficial normalizada solo en espacios por el extractor HTML existente, o `""` cuando no existe evidencia inequívoca. Si una ficha contiene varias frases admisibles, se conserva la primera en orden documental, que representa el aviso o ampliación vigente mostrado por AESAN.

Las tres familias semánticas observadas y aprobadas en el corpus accesible son:

1. AESAN tiene conocimiento de una notificación de alerta trasladada por autoridades sanitarias territoriales, mediante SCIRI.
2. AESAN ha sido informada por una autoridad sanitaria o comunidad autónoma, mediante SCIRI.
3. Una comunidad autónoma, o sus autoridades competentes o sanitarias, ha informado a AESAN mediante SCIRI, normalmente en una ampliación.

Se conserva asimismo la variante observada en la que AESAN omite la preposición entre «autoridades sanitarias» y «Cataluña». La guarda territorial explícita mantiene el comportamiento fail-closed.

El anclaje a `SCIRI` y la presencia de un nombre autonómico español explícito dentro de la propia frase notificante son obligatorios. La lista territorial funciona solo como guarda de evidencia; el upstream no emite código ni nombre canónico. Esto evita convertir en CCAA notificante tanto los notificantes extranjeros comunicados mediante RASFF como una autoridad nacional que mencione SCIRI.

El extractor falla cerrado. No admite:

- menciones territoriales de distribución;
- distribución nacional;
- ubicación de fabricante, operador o producto;
- origen del producto;
- territorio afectado;
- comunicación de una empresa a autoridades;
- traslado genérico a las autoridades de todas las comunidades autónomas;
- notificantes extranjeros RASFF;
- primera CCAA mencionada, listas arbitrarias, heurística difusa o inferencia.

## Ubicación y compatibilidad del campo

El campo vive junto al resto de propiedades source-derived de cada alerta en `feed.alerts[]`. Es aditivo y backwards-compatible con `schemaVersion: 1`.

Ejemplo mínimo:

```json
{
  "reference": "ES2026/485",
  "source": "AESAN",
  "notifyingText": "La Agencia Española de Seguridad Alimentaria y Nutrición (AESAN) ha tenido conocimiento a través del Sistema Coordinado de Intercambio Rápido de Información (SCIRI), de una notificación de alerta trasladada por las autoridades sanitarias de Galicia, relativa al etiquetado incorrecto de alérgeno (leche) en fideos de estilo oriental."
}
```

`cardFallback` emite `notifyingText: ""` cuando no hay ficha y conserva un valor previo cuando existe. El runtime `39c0899bfff630c2ca19e576d3470e88c2932006` acepta el campo en `AesanFeedAlert` y lo copia a `canonical.sourceRecord.notifyingText`.

## Impacto en hash y versiones

El `contentHash` upstream ya se calcula sobre `{ title, articleText, image, publishedAt }`. `notifyingText` es una derivación literal de `articleText`; volver a introducirlo como segundo material de hash duplicaría la misma evidencia sin añadir identidad semántica. Por ello se expone en el payload, pero no se añade de nuevo al objeto de hash. En el runtime comprobado, `canonicalContentHash` excluye de forma general `sourceRecord`; no existe una excepción creada para ocultar este campo. El estado de dimensiones mantiene separadamente `sourceContentHash` y `mappingVersion`.

| Métrica | Valor |
|---|---:|
| Registros con nueva evidencia no vacía | 84 |
| Registros que materializan el campo | 126 |
| Cambios de `contentHash` causados por el campo | 0 |
| Nuevas versiones esperadas causadas por el campo | 0 |
| Hashes del corpus actual que coinciden con `feed.json` | 126/126 |

La salida del feed sí cambia porque aparece una propiedad nueva. La identidad y el contador de versiones no cambian por esa propiedad. Una modificación futura de la frase oficial sí cambiará `articleText`, y por tanto el hash, como corresponde.

## Cobertura read-only

Estudio ejecutado el 5 de septiembre de 2026 sobre las 126 URLs de `feed.json`, descargadas directamente de `aesan.gob.es` y procesadas con el parser actualizado sin escribir producción.

| Métrica | Valor |
|---|---:|
| Total AESAN | 126 |
| `notifyingText` presente | 84 |
| `notifyingText` ausente | 42 |
| Canonicalizable por el runtime comprobado | 11 |
| Ambiguo | 0 |
| Errores de descarga/extracción | 0 |
| Mismatch de patrón downstream | 73 |

Desglose de patrones:

| Patrón | Registros |
|---|---:|
| Notificación trasladada por autoridades sanitarias | 40 |
| AESAN informada por autoridad territorial | 27 |
| Comunidad o autoridades territoriales informan a AESAN | 17 |

`phrase extracted` y `CCAA canonicalized downstream` son métricas distintas. La primera acredita que el upstream conserva evidencia oficial. La segunda depende de los patrones aprobados en el runtime.

## Contrato downstream

Runtime comprobado:

- repositorio: `cgam-coder/vigia-runtime`;
- branch: `work/19g-g-terminal-first-product-revision`;
- HEAD: `39c0899bfff630c2ca19e576d3470e88c2932006`;
- árbol: `c643ceed0d3197ac8eb0590641159acb0f81c58b`.

La forma del payload es compatible: el runtime tipa `notifyingText?: string` y lo conserva en `canonical.sourceRecord.notifyingText`. Sin embargo, `extractAesanNotifyingSubdivision` solo aprueba actualmente la familia «comunidad autónoma de X ha informado a la Agencia…». Canonicaliza 11 de las 84 frases extraídas; las otras 73 quedan sin relación territorial notificante.

Resultado: **DOWNSTREAM CONTRACT MISMATCH**. No se modifica `vigia-runtime` en este Work.

## Próximos pasos operativos

1. Auditoría independiente del contrato upstream y de los fixtures.
2. Adaptación separada y focalizada del runtime para las otras dos familias observadas, con fail-closed, antes de cualquier rebuild.
3. Re-audit de compatibilidad upstream/downstream.
4. Solo tras autorización expresa: merge upstream, rebuild histórico, sync y validación de dimensiones.

Este Work no autoriza ni ejecuta merge a `main`, Actions productivas, sync, D1, rebuild/backfill, despliegue, migraciones, cambios de environment/secrets ni activación de dominios.
