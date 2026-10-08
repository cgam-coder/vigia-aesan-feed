// verify/node_modules/drizzle-orm/entity.js
var entityKind = /* @__PURE__ */ Symbol.for("drizzle:entityKind");
function is(value, type) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value instanceof type) {
    return true;
  }
  if (!Object.prototype.hasOwnProperty.call(type, entityKind)) {
    throw new Error(
      `Class "${type.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`
    );
  }
  let cls = Object.getPrototypeOf(value).constructor;
  if (cls) {
    while (cls) {
      if (entityKind in cls && cls[entityKind] === type[entityKind]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }
  return false;
}

// verify/node_modules/drizzle-orm/table.utils.js
var TableName = /* @__PURE__ */ Symbol.for("drizzle:Name");

// verify/node_modules/drizzle-orm/table.js
var Schema = /* @__PURE__ */ Symbol.for("drizzle:Schema");
var Columns = /* @__PURE__ */ Symbol.for("drizzle:Columns");
var ExtraConfigColumns = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigColumns");
var OriginalName = /* @__PURE__ */ Symbol.for("drizzle:OriginalName");
var BaseName = /* @__PURE__ */ Symbol.for("drizzle:BaseName");
var IsAlias = /* @__PURE__ */ Symbol.for("drizzle:IsAlias");
var ExtraConfigBuilder = /* @__PURE__ */ Symbol.for("drizzle:ExtraConfigBuilder");
var IsDrizzleTable = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleTable");
var Table = class {
  static [entityKind] = "Table";
  /** @internal */
  static Symbol = {
    Name: TableName,
    Schema,
    OriginalName,
    Columns,
    ExtraConfigColumns,
    BaseName,
    IsAlias,
    ExtraConfigBuilder
  };
  /**
   * @internal
   * Can be changed if the table is aliased.
   */
  [TableName];
  /**
   * @internal
   * Used to store the original name of the table, before any aliasing.
   */
  [OriginalName];
  /** @internal */
  [Schema];
  /** @internal */
  [Columns];
  /** @internal */
  [ExtraConfigColumns];
  /**
   *  @internal
   * Used to store the table name before the transformation via the `tableCreator` functions.
   */
  [BaseName];
  /** @internal */
  [IsAlias] = false;
  /** @internal */
  [IsDrizzleTable] = true;
  /** @internal */
  [ExtraConfigBuilder] = void 0;
  constructor(name, schema, baseName) {
    this[TableName] = this[OriginalName] = name;
    this[Schema] = schema;
    this[BaseName] = baseName;
  }
};

// verify/node_modules/drizzle-orm/column.js
var Column = class {
  constructor(table, config) {
    this.table = table;
    this.config = config;
    this.name = config.name;
    this.keyAsName = config.keyAsName;
    this.notNull = config.notNull;
    this.default = config.default;
    this.defaultFn = config.defaultFn;
    this.onUpdateFn = config.onUpdateFn;
    this.hasDefault = config.hasDefault;
    this.primary = config.primaryKey;
    this.isUnique = config.isUnique;
    this.uniqueName = config.uniqueName;
    this.uniqueType = config.uniqueType;
    this.dataType = config.dataType;
    this.columnType = config.columnType;
    this.generated = config.generated;
    this.generatedIdentity = config.generatedIdentity;
  }
  static [entityKind] = "Column";
  name;
  keyAsName;
  primary;
  notNull;
  default;
  defaultFn;
  onUpdateFn;
  hasDefault;
  isUnique;
  uniqueName;
  uniqueType;
  dataType;
  columnType;
  enumValues = void 0;
  generated = void 0;
  generatedIdentity = void 0;
  config;
  mapFromDriverValue(value) {
    return value;
  }
  mapToDriverValue(value) {
    return value;
  }
  // ** @internal */
  shouldDisableInsert() {
    return this.config.generated !== void 0 && this.config.generated.type !== "byDefault";
  }
};

// verify/node_modules/drizzle-orm/column-builder.js
var ColumnBuilder = class {
  static [entityKind] = "ColumnBuilder";
  config;
  constructor(name, dataType, columnType) {
    this.config = {
      name,
      keyAsName: name === "",
      notNull: false,
      default: void 0,
      hasDefault: false,
      primaryKey: false,
      isUnique: false,
      uniqueName: void 0,
      uniqueType: void 0,
      dataType,
      columnType,
      generated: void 0
    };
  }
  /**
   * Changes the data type of the column. Commonly used with `json` columns. Also, useful for branded types.
   *
   * @example
   * ```ts
   * const users = pgTable('users', {
   * 	id: integer('id').$type<UserId>().primaryKey(),
   * 	details: json('details').$type<UserDetails>().notNull(),
   * });
   * ```
   */
  $type() {
    return this;
  }
  /**
   * Adds a `not null` clause to the column definition.
   *
   * Affects the `select` model of the table - columns *without* `not null` will be nullable on select.
   */
  notNull() {
    this.config.notNull = true;
    return this;
  }
  /**
   * Adds a `default <value>` clause to the column definition.
   *
   * Affects the `insert` model of the table - columns *with* `default` are optional on insert.
   *
   * If you need to set a dynamic default value, use {@link $defaultFn} instead.
   */
  default(value) {
    this.config.default = value;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Adds a dynamic default value to the column.
   * The function will be called when the row is inserted, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $defaultFn(fn) {
    this.config.defaultFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $defaultFn}.
   */
  $default = this.$defaultFn;
  /**
   * Adds a dynamic update value to the column.
   * The function will be called when the row is updated, and the returned value will be used as the column value if none is provided.
   * If no `default` (or `$defaultFn`) value is provided, the function will be called when the row is inserted as well, and the returned value will be used as the column value.
   *
   * **Note:** This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`.
   */
  $onUpdateFn(fn) {
    this.config.onUpdateFn = fn;
    this.config.hasDefault = true;
    return this;
  }
  /**
   * Alias for {@link $onUpdateFn}.
   */
  $onUpdate = this.$onUpdateFn;
  /**
   * Adds a `primary key` clause to the column definition. This implicitly makes the column `not null`.
   *
   * In SQLite, `integer primary key` implicitly makes the column auto-incrementing.
   */
  primaryKey() {
    this.config.primaryKey = true;
    this.config.notNull = true;
    return this;
  }
  /** @internal Sets the name of the column to the key within the table definition if a name was not given. */
  setName(name) {
    if (this.config.name !== "") return;
    this.config.name = name;
  }
};

// verify/node_modules/drizzle-orm/pg-core/foreign-keys.js
var ForeignKeyBuilder = class {
  static [entityKind] = "PgForeignKeyBuilder";
  /** @internal */
  reference;
  /** @internal */
  _onUpdate = "no action";
  /** @internal */
  _onDelete = "no action";
  constructor(config, actions) {
    this.reference = () => {
      const { name, columns, foreignColumns } = config();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action === void 0 ? "no action" : action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action === void 0 ? "no action" : action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey(table, this);
  }
};
var ForeignKey = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  static [entityKind] = "PgForeignKey";
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[TableName],
      ...columnNames,
      foreignColumns[0].table[TableName],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};

// verify/node_modules/drizzle-orm/tracing-utils.js
function iife(fn, ...args) {
  return fn(...args);
}

// verify/node_modules/drizzle-orm/pg-core/unique-constraint.js
function uniqueKeyName(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder = class {
  constructor(columns, name) {
    this.name = name;
    this.columns = columns;
  }
  static [entityKind] = "PgUniqueConstraintBuilder";
  /** @internal */
  columns;
  /** @internal */
  nullsNotDistinctConfig = false;
  nullsNotDistinct() {
    this.nullsNotDistinctConfig = true;
    return this;
  }
  /** @internal */
  build(table) {
    return new UniqueConstraint(table, this.columns, this.nullsNotDistinctConfig, this.name);
  }
};
var UniqueOnConstraintBuilder = class {
  static [entityKind] = "PgUniqueOnConstraintBuilder";
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns) {
    return new UniqueConstraintBuilder(columns, this.name);
  }
};
var UniqueConstraint = class {
  constructor(table, columns, nullsNotDistinct, name) {
    this.table = table;
    this.columns = columns;
    this.name = name ?? uniqueKeyName(this.table, this.columns.map((column) => column.name));
    this.nullsNotDistinct = nullsNotDistinct;
  }
  static [entityKind] = "PgUniqueConstraint";
  columns;
  name;
  nullsNotDistinct = false;
  getName() {
    return this.name;
  }
};

// verify/node_modules/drizzle-orm/pg-core/utils/array.js
function parsePgArrayValue(arrayString, startFrom, inQuotes) {
  for (let i = startFrom; i < arrayString.length; i++) {
    const char = arrayString[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (char === '"') {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i + 1];
    }
    if (inQuotes) {
      continue;
    }
    if (char === "," || char === "}") {
      return [arrayString.slice(startFrom, i).replace(/\\/g, ""), i];
    }
  }
  return [arrayString.slice(startFrom).replace(/\\/g, ""), arrayString.length];
}
function parsePgNestedArray(arrayString, startFrom = 0) {
  const result = [];
  let i = startFrom;
  let lastCharIsComma = false;
  while (i < arrayString.length) {
    const char = arrayString[i];
    if (char === ",") {
      if (lastCharIsComma || i === startFrom) {
        result.push("");
      }
      lastCharIsComma = true;
      i++;
      continue;
    }
    lastCharIsComma = false;
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === '"') {
      const [value2, startFrom2] = parsePgArrayValue(arrayString, i + 1, true);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    if (char === "}") {
      return [result, i + 1];
    }
    if (char === "{") {
      const [value2, startFrom2] = parsePgNestedArray(arrayString, i + 1);
      result.push(value2);
      i = startFrom2;
      continue;
    }
    const [value, newStartFrom] = parsePgArrayValue(arrayString, i, false);
    result.push(value);
    i = newStartFrom;
  }
  return [result, i];
}
function parsePgArray(arrayString) {
  const [result] = parsePgNestedArray(arrayString, 1);
  return result;
}
function makePgArray(array3) {
  return `{${array3.map((item) => {
    if (Array.isArray(item)) {
      return makePgArray(item);
    }
    if (typeof item === "string") {
      return `"${item.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${item}`;
  }).join(",")}}`;
}

// verify/node_modules/drizzle-orm/pg-core/columns/common.js
var PgColumnBuilder = class extends ColumnBuilder {
  foreignKeyConfigs = [];
  static [entityKind] = "PgColumnBuilder";
  array(size) {
    return new PgArrayBuilder(this.config.name, this, size);
  }
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name, config) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    this.config.uniqueType = config?.nulls;
    return this;
  }
  generatedAlwaysAs(as) {
    this.config.generated = {
      as,
      type: "always",
      mode: "stored"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return iife(
        (ref2, actions2) => {
          const builder = new ForeignKeyBuilder(() => {
            const foreignColumn = ref2();
            return { columns: [column], foreignColumns: [foreignColumn] };
          });
          if (actions2.onUpdate) {
            builder.onUpdate(actions2.onUpdate);
          }
          if (actions2.onDelete) {
            builder.onDelete(actions2.onDelete);
          }
          return builder.build(table);
        },
        ref,
        actions
      );
    });
  }
  /** @internal */
  buildExtraConfigColumn(table) {
    return new ExtraConfigColumn(table, this.config);
  }
};
var PgColumn = class extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
  static [entityKind] = "PgColumn";
};
var ExtraConfigColumn = class extends PgColumn {
  static [entityKind] = "ExtraConfigColumn";
  getSQLType() {
    return this.getSQLType();
  }
  indexConfig = {
    order: this.config.order ?? "asc",
    nulls: this.config.nulls ?? "last",
    opClass: this.config.opClass
  };
  defaultConfig = {
    order: "asc",
    nulls: "last",
    opClass: void 0
  };
  asc() {
    this.indexConfig.order = "asc";
    return this;
  }
  desc() {
    this.indexConfig.order = "desc";
    return this;
  }
  nullsFirst() {
    this.indexConfig.nulls = "first";
    return this;
  }
  nullsLast() {
    this.indexConfig.nulls = "last";
    return this;
  }
  /**
   * ### PostgreSQL documentation quote
   *
   * > An operator class with optional parameters can be specified for each column of an index.
   * The operator class identifies the operators to be used by the index for that column.
   * For example, a B-tree index on four-byte integers would use the int4_ops class;
   * this operator class includes comparison functions for four-byte integers.
   * In practice the default operator class for the column's data type is usually sufficient.
   * The main point of having operator classes is that for some data types, there could be more than one meaningful ordering.
   * For example, we might want to sort a complex-number data type either by absolute value or by real part.
   * We could do this by defining two operator classes for the data type and then selecting the proper class when creating an index.
   * More information about operator classes check:
   *
   * ### Useful links
   * https://www.postgresql.org/docs/current/sql-createindex.html
   *
   * https://www.postgresql.org/docs/current/indexes-opclass.html
   *
   * https://www.postgresql.org/docs/current/xindex.html
   *
   * ### Additional types
   * If you have the `pg_vector` extension installed in your database, you can use the
   * `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops`, `vector_l1_ops`, `bit_hamming_ops`, `bit_jaccard_ops`, `halfvec_l2_ops`, `sparsevec_l2_ops` options, which are predefined types.
   *
   * **You can always specify any string you want in the operator class, in case Drizzle doesn't have it natively in its types**
   *
   * @param opClass
   * @returns
   */
  op(opClass) {
    this.indexConfig.opClass = opClass;
    return this;
  }
};
var IndexedColumn = class {
  static [entityKind] = "IndexedColumn";
  constructor(name, keyAsName, type, indexConfig) {
    this.name = name;
    this.keyAsName = keyAsName;
    this.type = type;
    this.indexConfig = indexConfig;
  }
  name;
  keyAsName;
  type;
  indexConfig;
};
var PgArrayBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgArrayBuilder";
  constructor(name, baseBuilder, size) {
    super(name, "array", "PgArray");
    this.config.baseBuilder = baseBuilder;
    this.config.size = size;
  }
  /** @internal */
  build(table) {
    const baseColumn = this.config.baseBuilder.build(table);
    return new PgArray(
      table,
      this.config,
      baseColumn
    );
  }
};
var PgArray = class _PgArray extends PgColumn {
  constructor(table, config, baseColumn, range) {
    super(table, config);
    this.baseColumn = baseColumn;
    this.range = range;
    this.size = config.size;
  }
  size;
  static [entityKind] = "PgArray";
  getSQLType() {
    return `${this.baseColumn.getSQLType()}[${typeof this.size === "number" ? this.size : ""}]`;
  }
  mapFromDriverValue(value) {
    if (typeof value === "string") {
      value = parsePgArray(value);
    }
    return value.map((v) => this.baseColumn.mapFromDriverValue(v));
  }
  mapToDriverValue(value, isNestedArray = false) {
    const a = value.map(
      (v) => v === null ? null : is(this.baseColumn, _PgArray) ? this.baseColumn.mapToDriverValue(v, true) : this.baseColumn.mapToDriverValue(v)
    );
    if (isNestedArray) return a;
    return makePgArray(a);
  }
};

// verify/node_modules/drizzle-orm/pg-core/columns/enum.js
var PgEnumObjectColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgEnumObjectColumnBuilder";
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumObjectColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumObjectColumn(
      table,
      this.config
    );
  }
};
var PgEnumObjectColumn = class extends PgColumn {
  static [entityKind] = "PgEnumObjectColumn";
  enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};
var isPgEnumSym = /* @__PURE__ */ Symbol.for("drizzle:isPgEnum");
function isPgEnum(obj) {
  return !!obj && typeof obj === "function" && isPgEnumSym in obj && obj[isPgEnumSym] === true;
}
var PgEnumColumnBuilder = class extends PgColumnBuilder {
  static [entityKind] = "PgEnumColumnBuilder";
  constructor(name, enumInstance) {
    super(name, "string", "PgEnumColumn");
    this.config.enum = enumInstance;
  }
  /** @internal */
  build(table) {
    return new PgEnumColumn(
      table,
      this.config
    );
  }
};
var PgEnumColumn = class extends PgColumn {
  static [entityKind] = "PgEnumColumn";
  enum = this.config.enum;
  enumValues = this.config.enum.enumValues;
  constructor(table, config) {
    super(table, config);
    this.enum = config.enum;
  }
  getSQLType() {
    return this.enum.enumName;
  }
};

// verify/node_modules/drizzle-orm/subquery.js
var Subquery = class {
  static [entityKind] = "Subquery";
  constructor(sql2, fields, alias, isWith = false, usedTables = []) {
    this._ = {
      brand: "Subquery",
      sql: sql2,
      selectedFields: fields,
      alias,
      isWith,
      usedTables
    };
  }
  // getSQL(): SQL<unknown> {
  // 	return new SQL([this]);
  // }
};
var WithSubquery = class extends Subquery {
  static [entityKind] = "WithSubquery";
};

// verify/node_modules/drizzle-orm/version.js
var version = "0.45.2";

// verify/node_modules/drizzle-orm/tracing.js
var otel;
var rawTracer;
var tracer = {
  startActiveSpan(name, fn) {
    if (!otel) {
      return fn();
    }
    if (!rawTracer) {
      rawTracer = otel.trace.getTracer("drizzle-orm", version);
    }
    return iife(
      (otel2, rawTracer2) => rawTracer2.startActiveSpan(
        name,
        (span) => {
          try {
            return fn(span);
          } catch (e) {
            span.setStatus({
              code: otel2.SpanStatusCode.ERROR,
              message: e instanceof Error ? e.message : "Unknown error"
              // eslint-disable-line no-instanceof/no-instanceof
            });
            throw e;
          } finally {
            span.end();
          }
        }
      ),
      otel,
      rawTracer
    );
  }
};

// verify/node_modules/drizzle-orm/view-common.js
var ViewBaseConfig = /* @__PURE__ */ Symbol.for("drizzle:ViewBaseConfig");

// verify/node_modules/drizzle-orm/sql/sql.js
var FakePrimitiveParam = class {
  static [entityKind] = "FakePrimitiveParam";
};
function isSQLWrapper(value) {
  return value !== null && value !== void 0 && typeof value.getSQL === "function";
}
function mergeQueries(queries) {
  const result = { sql: "", params: [] };
  for (const query of queries) {
    result.sql += query.sql;
    result.params.push(...query.params);
    if (query.typings?.length) {
      if (!result.typings) {
        result.typings = [];
      }
      result.typings.push(...query.typings);
    }
  }
  return result;
}
var StringChunk = class {
  static [entityKind] = "StringChunk";
  value;
  constructor(value) {
    this.value = Array.isArray(value) ? value : [value];
  }
  getSQL() {
    return new SQL([this]);
  }
};
var SQL = class _SQL {
  constructor(queryChunks) {
    this.queryChunks = queryChunks;
    for (const chunk of queryChunks) {
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        this.usedTables.push(
          schemaName === void 0 ? chunk[Table.Symbol.Name] : schemaName + "." + chunk[Table.Symbol.Name]
        );
      }
    }
  }
  static [entityKind] = "SQL";
  /** @internal */
  decoder = noopDecoder;
  shouldInlineParams = false;
  /** @internal */
  usedTables = [];
  append(query) {
    this.queryChunks.push(...query.queryChunks);
    return this;
  }
  toQuery(config) {
    return tracer.startActiveSpan("drizzle.buildSQL", (span) => {
      const query = this.buildQueryFromSourceParams(this.queryChunks, config);
      span?.setAttributes({
        "drizzle.query.text": query.sql,
        "drizzle.query.params": JSON.stringify(query.params)
      });
      return query;
    });
  }
  buildQueryFromSourceParams(chunks, _config) {
    const config = Object.assign({}, _config, {
      inlineParams: _config.inlineParams || this.shouldInlineParams,
      paramStartIndex: _config.paramStartIndex || { value: 0 }
    });
    const {
      casing,
      escapeName,
      escapeParam,
      prepareTyping,
      inlineParams,
      paramStartIndex
    } = config;
    return mergeQueries(chunks.map((chunk) => {
      if (is(chunk, StringChunk)) {
        return { sql: chunk.value.join(""), params: [] };
      }
      if (is(chunk, Name)) {
        return { sql: escapeName(chunk.value), params: [] };
      }
      if (chunk === void 0) {
        return { sql: "", params: [] };
      }
      if (Array.isArray(chunk)) {
        const result = [new StringChunk("(")];
        for (const [i, p] of chunk.entries()) {
          result.push(p);
          if (i < chunk.length - 1) {
            result.push(new StringChunk(", "));
          }
        }
        result.push(new StringChunk(")"));
        return this.buildQueryFromSourceParams(result, config);
      }
      if (is(chunk, _SQL)) {
        return this.buildQueryFromSourceParams(chunk.queryChunks, {
          ...config,
          inlineParams: inlineParams || chunk.shouldInlineParams
        });
      }
      if (is(chunk, Table)) {
        const schemaName = chunk[Table.Symbol.Schema];
        const tableName = chunk[Table.Symbol.Name];
        return {
          sql: schemaName === void 0 || chunk[IsAlias] ? escapeName(tableName) : escapeName(schemaName) + "." + escapeName(tableName),
          params: []
        };
      }
      if (is(chunk, Column)) {
        const columnName = casing.getColumnCasing(chunk);
        if (_config.invokeSource === "indexes") {
          return { sql: escapeName(columnName), params: [] };
        }
        const schemaName = chunk.table[Table.Symbol.Schema];
        return {
          sql: chunk.table[IsAlias] || schemaName === void 0 ? escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName) : escapeName(schemaName) + "." + escapeName(chunk.table[Table.Symbol.Name]) + "." + escapeName(columnName),
          params: []
        };
      }
      if (is(chunk, View)) {
        const schemaName = chunk[ViewBaseConfig].schema;
        const viewName = chunk[ViewBaseConfig].name;
        return {
          sql: schemaName === void 0 || chunk[ViewBaseConfig].isAlias ? escapeName(viewName) : escapeName(schemaName) + "." + escapeName(viewName),
          params: []
        };
      }
      if (is(chunk, Param)) {
        if (is(chunk.value, Placeholder)) {
          return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
        }
        const mappedValue = chunk.value === null ? null : chunk.encoder.mapToDriverValue(chunk.value);
        if (is(mappedValue, _SQL)) {
          return this.buildQueryFromSourceParams([mappedValue], config);
        }
        if (inlineParams) {
          return { sql: this.mapInlineParam(mappedValue, config), params: [] };
        }
        let typings = ["none"];
        if (prepareTyping) {
          typings = [prepareTyping(chunk.encoder)];
        }
        return { sql: escapeParam(paramStartIndex.value++, mappedValue), params: [mappedValue], typings };
      }
      if (is(chunk, Placeholder)) {
        return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
      }
      if (is(chunk, _SQL.Aliased) && chunk.fieldAlias !== void 0) {
        return { sql: escapeName(chunk.fieldAlias), params: [] };
      }
      if (is(chunk, Subquery)) {
        if (chunk._.isWith) {
          return { sql: escapeName(chunk._.alias), params: [] };
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk._.sql,
          new StringChunk(") "),
          new Name(chunk._.alias)
        ], config);
      }
      if (isPgEnum(chunk)) {
        if (chunk.schema) {
          return { sql: escapeName(chunk.schema) + "." + escapeName(chunk.enumName), params: [] };
        }
        return { sql: escapeName(chunk.enumName), params: [] };
      }
      if (isSQLWrapper(chunk)) {
        if (chunk.shouldOmitSQLParens?.()) {
          return this.buildQueryFromSourceParams([chunk.getSQL()], config);
        }
        return this.buildQueryFromSourceParams([
          new StringChunk("("),
          chunk.getSQL(),
          new StringChunk(")")
        ], config);
      }
      if (inlineParams) {
        return { sql: this.mapInlineParam(chunk, config), params: [] };
      }
      return { sql: escapeParam(paramStartIndex.value++, chunk), params: [chunk], typings: ["none"] };
    }));
  }
  mapInlineParam(chunk, { escapeString }) {
    if (chunk === null) {
      return "null";
    }
    if (typeof chunk === "number" || typeof chunk === "boolean") {
      return chunk.toString();
    }
    if (typeof chunk === "string") {
      return escapeString(chunk);
    }
    if (typeof chunk === "object") {
      const mappedValueAsString = chunk.toString();
      if (mappedValueAsString === "[object Object]") {
        return escapeString(JSON.stringify(chunk));
      }
      return escapeString(mappedValueAsString);
    }
    throw new Error("Unexpected param value: " + chunk);
  }
  getSQL() {
    return this;
  }
  as(alias) {
    if (alias === void 0) {
      return this;
    }
    return new _SQL.Aliased(this, alias);
  }
  mapWith(decoder) {
    this.decoder = typeof decoder === "function" ? { mapFromDriverValue: decoder } : decoder;
    return this;
  }
  inlineParams() {
    this.shouldInlineParams = true;
    return this;
  }
  /**
   * This method is used to conditionally include a part of the query.
   *
   * @param condition - Condition to check
   * @returns itself if the condition is `true`, otherwise `undefined`
   */
  if(condition) {
    return condition ? this : void 0;
  }
};
var Name = class {
  constructor(value) {
    this.value = value;
  }
  static [entityKind] = "Name";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
var noopDecoder = {
  mapFromDriverValue: (value) => value
};
var noopEncoder = {
  mapToDriverValue: (value) => value
};
var noopMapper = {
  ...noopDecoder,
  ...noopEncoder
};
var Param = class {
  /**
   * @param value - Parameter value
   * @param encoder - Encoder to convert the value to a driver parameter
   */
  constructor(value, encoder = noopEncoder) {
    this.value = value;
    this.encoder = encoder;
  }
  static [entityKind] = "Param";
  brand;
  getSQL() {
    return new SQL([this]);
  }
};
function sql(strings, ...params) {
  const queryChunks = [];
  if (params.length > 0 || strings.length > 0 && strings[0] !== "") {
    queryChunks.push(new StringChunk(strings[0]));
  }
  for (const [paramIndex, param2] of params.entries()) {
    queryChunks.push(param2, new StringChunk(strings[paramIndex + 1]));
  }
  return new SQL(queryChunks);
}
((sql2) => {
  function empty() {
    return new SQL([]);
  }
  sql2.empty = empty;
  function fromList(list) {
    return new SQL(list);
  }
  sql2.fromList = fromList;
  function raw(str) {
    return new SQL([new StringChunk(str)]);
  }
  sql2.raw = raw;
  function join(chunks, separator) {
    const result = [];
    for (const [i, chunk] of chunks.entries()) {
      if (i > 0 && separator !== void 0) {
        result.push(separator);
      }
      result.push(chunk);
    }
    return new SQL(result);
  }
  sql2.join = join;
  function identifier(value) {
    return new Name(value);
  }
  sql2.identifier = identifier;
  function placeholder2(name2) {
    return new Placeholder(name2);
  }
  sql2.placeholder = placeholder2;
  function param2(value, encoder) {
    return new Param(value, encoder);
  }
  sql2.param = param2;
})(sql || (sql = {}));
((SQL2) => {
  class Aliased {
    constructor(sql2, fieldAlias) {
      this.sql = sql2;
      this.fieldAlias = fieldAlias;
    }
    static [entityKind] = "SQL.Aliased";
    /** @internal */
    isSelectionField = false;
    getSQL() {
      return this.sql;
    }
    /** @internal */
    clone() {
      return new Aliased(this.sql, this.fieldAlias);
    }
  }
  SQL2.Aliased = Aliased;
})(SQL || (SQL = {}));
var Placeholder = class {
  constructor(name2) {
    this.name = name2;
  }
  static [entityKind] = "Placeholder";
  getSQL() {
    return new SQL([this]);
  }
};
var IsDrizzleView = /* @__PURE__ */ Symbol.for("drizzle:IsDrizzleView");
var View = class {
  static [entityKind] = "View";
  /** @internal */
  [ViewBaseConfig];
  /** @internal */
  [IsDrizzleView] = true;
  constructor({ name: name2, schema, selectedFields, query }) {
    this[ViewBaseConfig] = {
      name: name2,
      originalName: name2,
      schema,
      selectedFields,
      query,
      isExisting: !query,
      isAlias: false
    };
  }
  getSQL() {
    return new SQL([this]);
  }
};
Column.prototype.getSQL = function() {
  return new SQL([this]);
};
Table.prototype.getSQL = function() {
  return new SQL([this]);
};
Subquery.prototype.getSQL = function() {
  return new SQL([this]);
};

// verify/node_modules/drizzle-orm/utils.js
function getColumnNameAndConfig(a, b) {
  return {
    name: typeof a === "string" && a.length > 0 ? a : "",
    config: typeof a === "object" ? a : b
  };
}
var textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();

// verify/node_modules/drizzle-orm/sqlite-core/foreign-keys.js
var ForeignKeyBuilder2 = class {
  static [entityKind] = "SQLiteForeignKeyBuilder";
  /** @internal */
  reference;
  /** @internal */
  _onUpdate;
  /** @internal */
  _onDelete;
  constructor(config, actions) {
    this.reference = () => {
      const { name, columns, foreignColumns } = config();
      return { name, columns, foreignTable: foreignColumns[0].table, foreignColumns };
    };
    if (actions) {
      this._onUpdate = actions.onUpdate;
      this._onDelete = actions.onDelete;
    }
  }
  onUpdate(action) {
    this._onUpdate = action;
    return this;
  }
  onDelete(action) {
    this._onDelete = action;
    return this;
  }
  /** @internal */
  build(table) {
    return new ForeignKey2(table, this);
  }
};
var ForeignKey2 = class {
  constructor(table, builder) {
    this.table = table;
    this.reference = builder.reference;
    this.onUpdate = builder._onUpdate;
    this.onDelete = builder._onDelete;
  }
  static [entityKind] = "SQLiteForeignKey";
  reference;
  onUpdate;
  onDelete;
  getName() {
    const { name, columns, foreignColumns } = this.reference();
    const columnNames = columns.map((column) => column.name);
    const foreignColumnNames = foreignColumns.map((column) => column.name);
    const chunks = [
      this.table[TableName],
      ...columnNames,
      foreignColumns[0].table[TableName],
      ...foreignColumnNames
    ];
    return name ?? `${chunks.join("_")}_fk`;
  }
};

// verify/node_modules/drizzle-orm/sqlite-core/unique-constraint.js
function uniqueKeyName2(table, columns) {
  return `${table[TableName]}_${columns.join("_")}_unique`;
}
var UniqueConstraintBuilder2 = class {
  constructor(columns, name) {
    this.name = name;
    this.columns = columns;
  }
  static [entityKind] = "SQLiteUniqueConstraintBuilder";
  /** @internal */
  columns;
  /** @internal */
  build(table) {
    return new UniqueConstraint2(table, this.columns, this.name);
  }
};
var UniqueOnConstraintBuilder2 = class {
  static [entityKind] = "SQLiteUniqueOnConstraintBuilder";
  /** @internal */
  name;
  constructor(name) {
    this.name = name;
  }
  on(...columns) {
    return new UniqueConstraintBuilder2(columns, this.name);
  }
};
var UniqueConstraint2 = class {
  constructor(table, columns, name) {
    this.table = table;
    this.columns = columns;
    this.name = name ?? uniqueKeyName2(this.table, this.columns.map((column) => column.name));
  }
  static [entityKind] = "SQLiteUniqueConstraint";
  columns;
  name;
  getName() {
    return this.name;
  }
};

// verify/node_modules/drizzle-orm/sqlite-core/columns/common.js
var SQLiteColumnBuilder = class extends ColumnBuilder {
  static [entityKind] = "SQLiteColumnBuilder";
  foreignKeyConfigs = [];
  references(ref, actions = {}) {
    this.foreignKeyConfigs.push({ ref, actions });
    return this;
  }
  unique(name) {
    this.config.isUnique = true;
    this.config.uniqueName = name;
    return this;
  }
  generatedAlwaysAs(as, config) {
    this.config.generated = {
      as,
      type: "always",
      mode: config?.mode ?? "virtual"
    };
    return this;
  }
  /** @internal */
  buildForeignKeys(column, table) {
    return this.foreignKeyConfigs.map(({ ref, actions }) => {
      return ((ref2, actions2) => {
        const builder = new ForeignKeyBuilder2(() => {
          const foreignColumn = ref2();
          return { columns: [column], foreignColumns: [foreignColumn] };
        });
        if (actions2.onUpdate) {
          builder.onUpdate(actions2.onUpdate);
        }
        if (actions2.onDelete) {
          builder.onDelete(actions2.onDelete);
        }
        return builder.build(table);
      })(ref, actions);
    });
  }
};
var SQLiteColumn = class extends Column {
  constructor(table, config) {
    if (!config.uniqueName) {
      config.uniqueName = uniqueKeyName2(table, [config.name]);
    }
    super(table, config);
    this.table = table;
  }
  static [entityKind] = "SQLiteColumn";
};

// verify/node_modules/drizzle-orm/sqlite-core/columns/blob.js
var SQLiteBigIntBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteBigIntBuilder";
  constructor(name) {
    super(name, "bigint", "SQLiteBigInt");
  }
  /** @internal */
  build(table) {
    return new SQLiteBigInt(table, this.config);
  }
};
var SQLiteBigInt = class extends SQLiteColumn {
  static [entityKind] = "SQLiteBigInt";
  getSQLType() {
    return "blob";
  }
  mapFromDriverValue(value) {
    if (typeof Buffer !== "undefined" && Buffer.from) {
      const buf = Buffer.isBuffer(value) ? value : value instanceof ArrayBuffer ? Buffer.from(value) : value.buffer ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(value);
      return BigInt(buf.toString("utf8"));
    }
    return BigInt(textDecoder.decode(value));
  }
  mapToDriverValue(value) {
    return Buffer.from(value.toString());
  }
};
var SQLiteBlobJsonBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteBlobJsonBuilder";
  constructor(name) {
    super(name, "json", "SQLiteBlobJson");
  }
  /** @internal */
  build(table) {
    return new SQLiteBlobJson(
      table,
      this.config
    );
  }
};
var SQLiteBlobJson = class extends SQLiteColumn {
  static [entityKind] = "SQLiteBlobJson";
  getSQLType() {
    return "blob";
  }
  mapFromDriverValue(value) {
    if (typeof Buffer !== "undefined" && Buffer.from) {
      const buf = Buffer.isBuffer(value) ? value : value instanceof ArrayBuffer ? Buffer.from(value) : value.buffer ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : Buffer.from(value);
      return JSON.parse(buf.toString("utf8"));
    }
    return JSON.parse(textDecoder.decode(value));
  }
  mapToDriverValue(value) {
    return Buffer.from(JSON.stringify(value));
  }
};
var SQLiteBlobBufferBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteBlobBufferBuilder";
  constructor(name) {
    super(name, "buffer", "SQLiteBlobBuffer");
  }
  /** @internal */
  build(table) {
    return new SQLiteBlobBuffer(table, this.config);
  }
};
var SQLiteBlobBuffer = class extends SQLiteColumn {
  static [entityKind] = "SQLiteBlobBuffer";
  mapFromDriverValue(value) {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    return Buffer.from(value);
  }
  getSQLType() {
    return "blob";
  }
};
function blob(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "json") {
    return new SQLiteBlobJsonBuilder(name);
  }
  if (config?.mode === "bigint") {
    return new SQLiteBigIntBuilder(name);
  }
  return new SQLiteBlobBufferBuilder(name);
}

// verify/node_modules/drizzle-orm/sqlite-core/columns/custom.js
var SQLiteCustomColumnBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteCustomColumnBuilder";
  constructor(name, fieldConfig, customTypeParams) {
    super(name, "custom", "SQLiteCustomColumn");
    this.config.fieldConfig = fieldConfig;
    this.config.customTypeParams = customTypeParams;
  }
  /** @internal */
  build(table) {
    return new SQLiteCustomColumn(
      table,
      this.config
    );
  }
};
var SQLiteCustomColumn = class extends SQLiteColumn {
  static [entityKind] = "SQLiteCustomColumn";
  sqlName;
  mapTo;
  mapFrom;
  constructor(table, config) {
    super(table, config);
    this.sqlName = config.customTypeParams.dataType(config.fieldConfig);
    this.mapTo = config.customTypeParams.toDriver;
    this.mapFrom = config.customTypeParams.fromDriver;
  }
  getSQLType() {
    return this.sqlName;
  }
  mapFromDriverValue(value) {
    return typeof this.mapFrom === "function" ? this.mapFrom(value) : value;
  }
  mapToDriverValue(value) {
    return typeof this.mapTo === "function" ? this.mapTo(value) : value;
  }
};
function customType(customTypeParams) {
  return (a, b) => {
    const { name, config } = getColumnNameAndConfig(a, b);
    return new SQLiteCustomColumnBuilder(
      name,
      config,
      customTypeParams
    );
  };
}

// verify/node_modules/drizzle-orm/sqlite-core/columns/integer.js
var SQLiteBaseIntegerBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteBaseIntegerBuilder";
  constructor(name, dataType, columnType) {
    super(name, dataType, columnType);
    this.config.autoIncrement = false;
  }
  primaryKey(config) {
    if (config?.autoIncrement) {
      this.config.autoIncrement = true;
    }
    this.config.hasDefault = true;
    return super.primaryKey();
  }
};
var SQLiteBaseInteger = class extends SQLiteColumn {
  static [entityKind] = "SQLiteBaseInteger";
  autoIncrement = this.config.autoIncrement;
  getSQLType() {
    return "integer";
  }
};
var SQLiteIntegerBuilder = class extends SQLiteBaseIntegerBuilder {
  static [entityKind] = "SQLiteIntegerBuilder";
  constructor(name) {
    super(name, "number", "SQLiteInteger");
  }
  build(table) {
    return new SQLiteInteger(
      table,
      this.config
    );
  }
};
var SQLiteInteger = class extends SQLiteBaseInteger {
  static [entityKind] = "SQLiteInteger";
};
var SQLiteTimestampBuilder = class extends SQLiteBaseIntegerBuilder {
  static [entityKind] = "SQLiteTimestampBuilder";
  constructor(name, mode) {
    super(name, "date", "SQLiteTimestamp");
    this.config.mode = mode;
  }
  /**
   * @deprecated Use `default()` with your own expression instead.
   *
   * Adds `DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))` to the column, which is the current epoch timestamp in milliseconds.
   */
  defaultNow() {
    return this.default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`);
  }
  build(table) {
    return new SQLiteTimestamp(
      table,
      this.config
    );
  }
};
var SQLiteTimestamp = class extends SQLiteBaseInteger {
  static [entityKind] = "SQLiteTimestamp";
  mode = this.config.mode;
  mapFromDriverValue(value) {
    if (this.config.mode === "timestamp") {
      return new Date(value * 1e3);
    }
    return new Date(value);
  }
  mapToDriverValue(value) {
    const unix = value.getTime();
    if (this.config.mode === "timestamp") {
      return Math.floor(unix / 1e3);
    }
    return unix;
  }
};
var SQLiteBooleanBuilder = class extends SQLiteBaseIntegerBuilder {
  static [entityKind] = "SQLiteBooleanBuilder";
  constructor(name, mode) {
    super(name, "boolean", "SQLiteBoolean");
    this.config.mode = mode;
  }
  build(table) {
    return new SQLiteBoolean(
      table,
      this.config
    );
  }
};
var SQLiteBoolean = class extends SQLiteBaseInteger {
  static [entityKind] = "SQLiteBoolean";
  mode = this.config.mode;
  mapFromDriverValue(value) {
    return Number(value) === 1;
  }
  mapToDriverValue(value) {
    return value ? 1 : 0;
  }
};
function integer(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config?.mode === "timestamp" || config?.mode === "timestamp_ms") {
    return new SQLiteTimestampBuilder(name, config.mode);
  }
  if (config?.mode === "boolean") {
    return new SQLiteBooleanBuilder(name, config.mode);
  }
  return new SQLiteIntegerBuilder(name);
}

// verify/node_modules/drizzle-orm/sqlite-core/columns/numeric.js
var SQLiteNumericBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteNumericBuilder";
  constructor(name) {
    super(name, "string", "SQLiteNumeric");
  }
  /** @internal */
  build(table) {
    return new SQLiteNumeric(
      table,
      this.config
    );
  }
};
var SQLiteNumeric = class extends SQLiteColumn {
  static [entityKind] = "SQLiteNumeric";
  mapFromDriverValue(value) {
    if (typeof value === "string") return value;
    return String(value);
  }
  getSQLType() {
    return "numeric";
  }
};
var SQLiteNumericNumberBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteNumericNumberBuilder";
  constructor(name) {
    super(name, "number", "SQLiteNumericNumber");
  }
  /** @internal */
  build(table) {
    return new SQLiteNumericNumber(
      table,
      this.config
    );
  }
};
var SQLiteNumericNumber = class extends SQLiteColumn {
  static [entityKind] = "SQLiteNumericNumber";
  mapFromDriverValue(value) {
    if (typeof value === "number") return value;
    return Number(value);
  }
  mapToDriverValue = String;
  getSQLType() {
    return "numeric";
  }
};
var SQLiteNumericBigIntBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteNumericBigIntBuilder";
  constructor(name) {
    super(name, "bigint", "SQLiteNumericBigInt");
  }
  /** @internal */
  build(table) {
    return new SQLiteNumericBigInt(
      table,
      this.config
    );
  }
};
var SQLiteNumericBigInt = class extends SQLiteColumn {
  static [entityKind] = "SQLiteNumericBigInt";
  mapFromDriverValue = BigInt;
  mapToDriverValue = String;
  getSQLType() {
    return "numeric";
  }
};
function numeric(a, b) {
  const { name, config } = getColumnNameAndConfig(a, b);
  const mode = config?.mode;
  return mode === "number" ? new SQLiteNumericNumberBuilder(name) : mode === "bigint" ? new SQLiteNumericBigIntBuilder(name) : new SQLiteNumericBuilder(name);
}

// verify/node_modules/drizzle-orm/sqlite-core/columns/real.js
var SQLiteRealBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteRealBuilder";
  constructor(name) {
    super(name, "number", "SQLiteReal");
  }
  /** @internal */
  build(table) {
    return new SQLiteReal(table, this.config);
  }
};
var SQLiteReal = class extends SQLiteColumn {
  static [entityKind] = "SQLiteReal";
  getSQLType() {
    return "real";
  }
};
function real(name) {
  return new SQLiteRealBuilder(name ?? "");
}

// verify/node_modules/drizzle-orm/sqlite-core/columns/text.js
var SQLiteTextBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteTextBuilder";
  constructor(name, config) {
    super(name, "string", "SQLiteText");
    this.config.enumValues = config.enum;
    this.config.length = config.length;
  }
  /** @internal */
  build(table) {
    return new SQLiteText(
      table,
      this.config
    );
  }
};
var SQLiteText = class extends SQLiteColumn {
  static [entityKind] = "SQLiteText";
  enumValues = this.config.enumValues;
  length = this.config.length;
  constructor(table, config) {
    super(table, config);
  }
  getSQLType() {
    return `text${this.config.length ? `(${this.config.length})` : ""}`;
  }
};
var SQLiteTextJsonBuilder = class extends SQLiteColumnBuilder {
  static [entityKind] = "SQLiteTextJsonBuilder";
  constructor(name) {
    super(name, "json", "SQLiteTextJson");
  }
  /** @internal */
  build(table) {
    return new SQLiteTextJson(
      table,
      this.config
    );
  }
};
var SQLiteTextJson = class extends SQLiteColumn {
  static [entityKind] = "SQLiteTextJson";
  getSQLType() {
    return "text";
  }
  mapFromDriverValue(value) {
    return JSON.parse(value);
  }
  mapToDriverValue(value) {
    return JSON.stringify(value);
  }
};
function text(a, b = {}) {
  const { name, config } = getColumnNameAndConfig(a, b);
  if (config.mode === "json") {
    return new SQLiteTextJsonBuilder(name);
  }
  return new SQLiteTextBuilder(name, config);
}

// verify/node_modules/drizzle-orm/sqlite-core/columns/all.js
function getSQLiteColumnBuilders() {
  return {
    blob,
    customType,
    integer,
    numeric,
    real,
    text
  };
}

// verify/node_modules/drizzle-orm/sqlite-core/table.js
var InlineForeignKeys = /* @__PURE__ */ Symbol.for("drizzle:SQLiteInlineForeignKeys");
var SQLiteTable = class extends Table {
  static [entityKind] = "SQLiteTable";
  /** @internal */
  static Symbol = Object.assign({}, Table.Symbol, {
    InlineForeignKeys
  });
  /** @internal */
  [Table.Symbol.Columns];
  /** @internal */
  [InlineForeignKeys] = [];
  /** @internal */
  [Table.Symbol.ExtraConfigBuilder] = void 0;
};
function sqliteTableBase(name, columns, extraConfig, schema, baseName = name) {
  const rawTable = new SQLiteTable(name, schema, baseName);
  const parsedColumns = typeof columns === "function" ? columns(getSQLiteColumnBuilders()) : columns;
  const builtColumns = Object.fromEntries(
    Object.entries(parsedColumns).map(([name2, colBuilderBase]) => {
      const colBuilder = colBuilderBase;
      colBuilder.setName(name2);
      const column = colBuilder.build(rawTable);
      rawTable[InlineForeignKeys].push(...colBuilder.buildForeignKeys(column, rawTable));
      return [name2, column];
    })
  );
  const table = Object.assign(rawTable, builtColumns);
  table[Table.Symbol.Columns] = builtColumns;
  table[Table.Symbol.ExtraConfigColumns] = builtColumns;
  if (extraConfig) {
    table[SQLiteTable.Symbol.ExtraConfigBuilder] = extraConfig;
  }
  return table;
}
var sqliteTable = (name, columns, extraConfig) => {
  return sqliteTableBase(name, columns, extraConfig);
};

// verify/node_modules/drizzle-orm/sqlite-core/checks.js
var CheckBuilder = class {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
  static [entityKind] = "SQLiteCheckBuilder";
  brand;
  build(table) {
    return new Check(table, this);
  }
};
var Check = class {
  constructor(table, builder) {
    this.table = table;
    this.name = builder.name;
    this.value = builder.value;
  }
  static [entityKind] = "SQLiteCheck";
  name;
  value;
};
function check(name, value) {
  return new CheckBuilder(name, value);
}

// verify/node_modules/drizzle-orm/sqlite-core/indexes.js
var IndexBuilderOn = class {
  constructor(name, unique) {
    this.name = name;
    this.unique = unique;
  }
  static [entityKind] = "SQLiteIndexBuilderOn";
  on(...columns) {
    return new IndexBuilder(this.name, columns, this.unique);
  }
};
var IndexBuilder = class {
  static [entityKind] = "SQLiteIndexBuilder";
  /** @internal */
  config;
  constructor(name, columns, unique) {
    this.config = {
      name,
      columns,
      unique,
      where: void 0
    };
  }
  /**
   * Condition for partial index.
   */
  where(condition) {
    this.config.where = condition;
    return this;
  }
  /** @internal */
  build(table) {
    return new Index(this.config, table);
  }
};
var Index = class {
  static [entityKind] = "SQLiteIndex";
  config;
  constructor(config, table) {
    this.config = { ...config, table };
  }
};
function index(name) {
  return new IndexBuilderOn(name, false);
}
function uniqueIndex(name) {
  return new IndexBuilderOn(name, true);
}

// candidate-probe-v4-src/db/schema.ts
var alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull(),
  source: text("source").notNull(),
  type: text("type").notNull(),
  priority: text("priority").notNull().default("Media"),
  title: text("title").notNull(),
  product: text("product").notNull().default("No especificado"),
  brand: text("brand").notNull().default(""),
  productClass: text("product_class").notNull().default("Sin clasificar"),
  productKey: text("product_key").notNull().default(""),
  brandKey: text("brand_key").notNull().default(""),
  provider: text("provider").notNull().default(""),
  providerKey: text("provider_key").notNull().default(""),
  providerRole: text("provider_role").notNull().default(""),
  providerEvidence: text("provider_evidence").notNull().default(""),
  hazard: text("hazard").notNull().default("Consultar publicaci\xF3n oficial"),
  origin: text("origin").notNull().default("No indicado"),
  scope: text("scope").notNull().default("No indicado"),
  action: text("action").notNull().default("Consultar publicaci\xF3n oficial"),
  lots: text("lots", { mode: "json" }).$type().notNull().default([]),
  imageUrl: text("image_url"),
  url: text("url").notNull(),
  publishedAt: text("published_at"),
  detectedAt: text("detected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  contentHash: text("content_hash").notNull(),
  versionCount: integer("version_count").notNull().default(1),
  isUpdate: integer("is_update", { mode: "boolean" }).notNull().default(false),
  canonicalPayload: text("canonical_json", { mode: "json" }).$type().notNull().default({}),
  aesanTaxonomyStatus: text("aesan_taxonomy_status").generatedAlwaysAs(
    sql`CASE WHEN source = 'AESAN' AND json_valid(canonical_json) THEN json_extract(canonical_json, '$.sourceRecord.aesanAlertClassification.status') ELSE NULL END`,
    { mode: "virtual" }
  ),
  aesanTaxonomyCode: text("aesan_taxonomy_code").generatedAlwaysAs(
    sql`CASE WHEN source = 'AESAN' AND json_valid(canonical_json) THEN json_extract(canonical_json, '$.sourceRecord.aesanAlertClassification.code') ELSE NULL END`,
    { mode: "virtual" }
  )
}, (table) => [
  uniqueIndex("alerts_source_reference_unique").on(table.source, table.reference),
  index("alerts_published_at_idx").on(table.publishedAt),
  index("alerts_source_idx").on(table.source),
  index("alerts_query_date_id_idx").on(table.publishedAt, table.id),
  index("alerts_query_source_date_id_idx").on(table.source, table.publishedAt, table.id),
  index("alerts_reference_idx").on(table.reference),
  index("alerts_product_key_idx").on(table.productKey),
  index("alerts_brand_key_idx").on(table.brandKey),
  index("alerts_provider_key_idx").on(table.providerKey),
  index("alerts_aesan_taxonomy_known_code_id_idx").on(table.aesanTaxonomyCode, table.id).where(sql`${table.source} = 'AESAN' AND ${table.aesanTaxonomyStatus} = 'known'`)
]);
var alertVersions = sqliteTable("alert_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: text("alert_id").notNull(),
  contentHash: text("content_hash").notNull(),
  snapshot: text("snapshot", { mode: "json" }).$type().notNull(),
  detectedAt: text("detected_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  uniqueIndex("alert_versions_alert_hash_unique").on(table.alertId, table.contentHash),
  index("alert_versions_alert_id_idx").on(table.alertId)
]);
var alertSourceIdentities = sqliteTable("alert_source_identities", {
  source: text("source").notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  alertId: text("alert_id").primaryKey().references(() => alerts.id, { onDelete: "cascade" })
}, (table) => [
  check("alert_source_identities_nonempty_check", sql`length(trim(${table.sourceRecordId})) > 0`),
  uniqueIndex("alert_source_identities_source_record_unique").on(table.source, table.sourceRecordId),
  index("alert_source_identities_source_alert_idx").on(table.source, table.alertId)
]);
var alertAliases = sqliteTable("alert_aliases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  aliasType: text("alias_type").notNull(),
  aliasValue: text("alias_value").notNull(),
  alertId: text("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  check("alert_aliases_type_check", sql`${table.aliasType} IN ('reference', 'alert_id')`),
  check("alert_aliases_nonempty_check", sql`length(trim(${table.aliasValue})) > 0`),
  uniqueIndex("alert_aliases_source_type_value_unique").on(table.source, table.aliasType, table.aliasValue),
  index("alert_aliases_alert_id_idx").on(table.alertId)
]);
var sourceChecks = sqliteTable("source_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  checkedAt: text("checked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  status: text("status").notNull(),
  foundCount: integer("found_count").notNull().default(0),
  changedCount: integer("changed_count").notNull().default(0),
  error: text("error")
}, (table) => [index("source_checks_source_date_idx").on(table.source, table.checkedAt)]);
var sourceFreshnessState = sqliteTable("source_freshness_state", {
  source: text("source").primaryKey(),
  checkedAt: text("checked_at").notNull(),
  status: text("status").notNull(),
  officialLatestIdentity: text("official_latest_identity"),
  officialLatestPublishedAt: text("official_latest_published_at"),
  officialLatestUpdatedAt: text("official_latest_updated_at"),
  nagameLatestIdentity: text("nagame_latest_identity"),
  nagameLatestPublishedAt: text("nagame_latest_published_at"),
  nagameLatestUpdatedAt: text("nagame_latest_updated_at"),
  latestIdentityParity: integer("latest_identity_parity", { mode: "boolean" }).notNull().default(false),
  sampleOfficialCount: integer("sample_official_count").notNull().default(0),
  sampleNagameCount: integer("sample_nagame_count").notNull().default(0),
  missingOfficialIdentities: text("missing_official_identities", { mode: "json" }).$type().notNull().default([]),
  unexpectedNagameIdentities: text("unexpected_nagame_identities", { mode: "json" }).$type().notNull().default([]),
  revisionMismatches: text("revision_mismatches", { mode: "json" }).$type().notNull().default([]),
  lastSyncSuccessAt: text("last_sync_success_at"),
  syncAgeMinutes: integer("sync_age_minutes"),
  lagMinutes: integer("lag_minutes"),
  activeLease: integer("active_lease", { mode: "boolean" }).notNull().default(false),
  revisionStatus: text("revision_status").notNull().default("unknown"),
  revisionLastSuccessAt: text("revision_last_success_at"),
  revisionAgeMinutes: integer("revision_age_minutes"),
  revisionCycleStartedAt: text("revision_cycle_started_at"),
  revisionProgress: integer("revision_progress"),
  revisionTotal: integer("revision_total"),
  lastSuccessfulParityAt: text("last_successful_parity_at"),
  error: text("error"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  check("source_freshness_state_status_check", sql`${table.status} IN ('fresh', 'degraded', 'stale', 'unknown')`),
  index("source_freshness_state_status_checked_idx").on(table.status, table.checkedAt)
]);
var sourceSyncState = sqliteTable("source_sync_state", {
  source: text("source").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull().default("idle"),
  cursor: integer("cursor").notNull().default(0),
  planVersion: text("plan_version"),
  cursorKey: text("cursor_key"),
  totalUnits: integer("total_units").notNull().default(0),
  pagesScanned: integer("pages_scanned").notNull().default(0),
  recordsObserved: integer("records_observed").notNull().default(0),
  recordsPersisted: integer("records_persisted").notNull().default(0),
  newCount: integer("new_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  detailFailures: integer("detail_failures").notNull().default(0),
  pageErrors: integer("page_errors").notNull().default(0),
  oldestPublishedAt: text("oldest_published_at"),
  newestPublishedAt: text("newest_published_at"),
  coverage: text("coverage").notNull().default("unknown"),
  startedAt: text("started_at"),
  lastSuccessAt: text("last_success_at"),
  completedAt: text("completed_at"),
  lastError: text("last_error"),
  leaseOwnerId: text("lease_owner_id"),
  leaseMode: text("lease_mode"),
  leaseExpiresAt: text("lease_expires_at"),
  lastSkippedAt: text("last_skipped_at"),
  lastSkipReason: text("last_skip_reason"),
  lastSkippedOwnerId: text("last_skipped_owner_id"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  uniqueIndex("source_sync_state_source_mode_unique").on(table.source, table.mode),
  index("source_sync_state_status_idx").on(table.status)
]);
var sourceSyncLocks = sqliteTable("source_sync_locks", {
  source: text("source").primaryKey(),
  ownerId: text("owner_id").notNull(),
  mode: text("mode").notNull(),
  acquiredAt: text("acquired_at").notNull(),
  heartbeatAt: text("heartbeat_at").notNull(),
  expiresAt: text("expires_at").notNull()
}, (table) => [index("source_sync_locks_expires_at_idx").on(table.expiresAt)]);
var sourceRevisionCertifications = sqliteTable("source_revision_certifications", {
  source: text("source").notNull(),
  mode: text("mode").notNull(),
  cycleId: text("cycle_id").notNull(),
  completedAt: text("completed_at").notNull(),
  totalUnits: integer("total_units").notNull(),
  recordsObserved: integer("records_observed").notNull(),
  coverage: text("coverage").notNull(),
  auditStatus: text("audit_status").notNull(),
  auditCheckedAt: text("audit_checked_at").notNull(),
  evidence: text("evidence_json", { mode: "json" }).$type().notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  uniqueIndex("source_revision_certifications_source_mode_unique").on(table.source, table.mode),
  index("source_revision_certifications_completed_idx").on(table.completedAt),
  check("source_revision_certifications_coverage_check", sql`${table.coverage} = 'official-index-complete'`),
  check("source_revision_certifications_audit_check", sql`${table.auditStatus} = 'passed'`)
]);
var sourceBackfillSnapshots = sqliteTable("source_backfill_snapshots", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  purpose: text("purpose").notNull(),
  createdAt: text("created_at").notNull(),
  alertCount: integer("alert_count").notNull(),
  sourceAlertCount: integer("source_alert_count").notNull(),
  versionCount: integer("version_count").notNull(),
  checksum: text("checksum").notNull(),
  sourceDataChecksum: text("source_data_checksum").notNull(),
  status: text("status").notNull(),
  backfillStartedAt: text("backfill_started_at"),
  restoredAt: text("restored_at")
}, (table) => [
  index("source_backfill_snapshots_source_created_idx").on(table.source, table.createdAt),
  index("source_backfill_snapshots_status_idx").on(table.status)
]);
var sourceBackfillSnapshotChunks = sqliteTable("source_backfill_snapshot_chunks", {
  snapshotId: text("snapshot_id").notNull(),
  sequence: integer("sequence").notNull(),
  chunkText: text("chunk_text").notNull()
}, (table) => [
  uniqueIndex("source_backfill_snapshot_chunks_unique").on(table.snapshotId, table.sequence),
  index("source_backfill_snapshot_chunks_snapshot_idx").on(table.snapshotId)
]);
var alertDimensionState = sqliteTable("alert_dimension_state", {
  alertId: text("alert_id").primaryKey().references(() => alerts.id, { onDelete: "cascade" }),
  sourceContentHash: text("source_content_hash").notNull(),
  mappingVersion: text("mapping_version").notNull(),
  productDomain: text("product_domain").notNull(),
  categoryStatus: text("category_status").notNull(),
  hazardStatus: text("hazard_status").notNull(),
  geographyStatus: text("geography_status").notNull(),
  actorStatus: text("actor_status").notNull(),
  affectsSpain: text("affects_spain").notNull(),
  affectsSpainReason: text("affects_spain_reason").notNull(),
  derivedAt: text("derived_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  check("alert_dimension_state_product_domain_check", sql`${table.productDomain} IN ('human_food', 'animal_feed', 'non_food', 'unknown')`),
  check("alert_dimension_state_category_status_check", sql`${table.categoryStatus} IN ('mapped', 'unmapped', 'unknown')`),
  check("alert_dimension_state_hazard_status_check", sql`${table.hazardStatus} IN ('mapped', 'unmapped', 'unknown')`),
  check("alert_dimension_state_geography_status_check", sql`${table.geographyStatus} IN ('mapped', 'partial', 'unmapped', 'unknown')`),
  check("alert_dimension_state_actor_status_check", sql`${table.actorStatus} IN ('mapped', 'unknown')`),
  check("alert_dimension_state_affects_spain_check", sql`${table.affectsSpain} IN ('true', 'false', 'unknown')`),
  index("alert_dimension_state_domain_alert_idx").on(table.productDomain, table.alertId),
  index("alert_dimension_state_spain_alert_idx").on(table.affectsSpain, table.alertId)
]);
var alertCategories = sqliteTable("alert_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: text("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  categoryKey: text("category_key").notNull(),
  rawValue: text("raw_value").notNull(),
  sourceNormalized: text("source_normalized").notNull(),
  canonicalCode: text("canonical_code").notNull(),
  status: text("status").notNull(),
  sourceField: text("source_field").notNull(),
  evidenceType: text("evidence_type").notNull(),
  reason: text("reason").notNull(),
  mappingVersion: text("mapping_version").notNull()
}, (table) => [
  check("alert_categories_status_check", sql`${table.status} IN ('mapped', 'unmapped', 'unknown')`),
  uniqueIndex("alert_categories_alert_key_unique").on(table.alertId, table.categoryKey),
  index("alert_categories_code_alert_idx").on(table.canonicalCode, table.alertId),
  index("alert_categories_alert_idx").on(table.alertId)
]);
var alertHazards = sqliteTable("alert_hazards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: text("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  hazardKey: text("hazard_key").notNull(),
  rawValue: text("raw_value").notNull(),
  sourceNormalized: text("source_normalized").notNull(),
  canonicalCode: text("canonical_code").notNull(),
  status: text("status").notNull(),
  sourceField: text("source_field").notNull(),
  evidenceType: text("evidence_type").notNull(),
  reason: text("reason").notNull(),
  mappingVersion: text("mapping_version").notNull()
}, (table) => [
  check("alert_hazards_status_check", sql`${table.status} IN ('mapped', 'unmapped', 'unknown')`),
  uniqueIndex("alert_hazards_alert_key_unique").on(table.alertId, table.hazardKey),
  index("alert_hazards_code_alert_idx").on(table.canonicalCode, table.alertId),
  index("alert_hazards_alert_idx").on(table.alertId)
]);
var alertGeographies = sqliteTable("alert_geographies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: text("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  geographyKey: text("geography_key").notNull(),
  geographyCode: text("geography_code").notNull(),
  codeScheme: text("code_scheme").notNull(),
  countryCode: text("country_code").notNull(),
  subdivisionCode: text("subdivision_code").notNull(),
  adminLevel: text("admin_level").notNull(),
  rawValue: text("raw_value").notNull(),
  source: text("source").notNull(),
  sourceField: text("source_field").notNull(),
  evidenceType: text("evidence_type").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull(),
  mappingVersion: text("mapping_version").notNull()
}, (table) => [
  check("alert_geographies_role_check", sql`${table.role} IN ('origin', 'notifying', 'distribution', 'affected')`),
  check("alert_geographies_status_check", sql`${table.status} IN ('mapped', 'unmapped')`),
  check("alert_geographies_admin_level_check", sql`${table.adminLevel} IN ('country', 'subdivision', 'territory', 'unknown')`),
  uniqueIndex("alert_geographies_semantic_unique").on(table.alertId, table.role, table.geographyKey, table.sourceField),
  index("alert_geographies_alert_role_idx").on(table.alertId, table.role),
  index("alert_geographies_role_geography_alert_idx").on(table.role, table.geographyCode, table.alertId),
  index("alert_geographies_role_country_alert_idx").on(table.role, table.countryCode, table.alertId),
  index("alert_geographies_role_subdivision_alert_idx").on(table.role, table.subdivisionCode, table.alertId)
]);
var alertActors = sqliteTable("alert_actors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: text("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  actorKey: text("actor_key").notNull(),
  rawName: text("raw_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  sourceField: text("source_field").notNull(),
  evidence: text("evidence").notNull(),
  mappingVersion: text("mapping_version").notNull()
}, (table) => [
  uniqueIndex("alert_actors_semantic_unique").on(table.alertId, table.role, table.actorKey, table.sourceField),
  index("alert_actors_alert_role_idx").on(table.alertId, table.role),
  index("alert_actors_role_key_alert_idx").on(table.role, table.actorKey, table.alertId)
]);
var dimensionRebuildState = sqliteTable("dimension_rebuild_state", {
  source: text("source").primaryKey(),
  mappingVersion: text("mapping_version").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  cursorAlertId: text("cursor_alert_id"),
  scannedCount: integer("scanned_count").notNull().default(0),
  candidateRelationCount: integer("candidate_relation_count").notNull().default(0),
  writeCount: integer("write_count").notNull().default(0),
  mappedCount: integer("mapped_count").notNull().default(0),
  unknownCount: integer("unknown_count").notNull().default(0),
  unmappedCount: integer("unmapped_count").notNull().default(0),
  ambiguousCount: integer("ambiguous_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  leaseOwnerId: text("lease_owner_id"),
  leaseExpiresAt: text("lease_expires_at"),
  lastError: text("last_error"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
  check("dimension_rebuild_state_mode_check", sql`${table.mode} IN ('dry_run', 'apply')`),
  check("dimension_rebuild_state_status_check", sql`${table.status} IN ('idle', 'running', 'completed', 'failed')`),
  index("dimension_rebuild_state_status_idx").on(table.status)
]);

// candidate-probe-v4-src/db/index.ts
function getD1() {
  const database = globalThis.__VIGIA_DB__;
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the active hosting target with a `DB` binding before using the database."
    );
  }
  return database;
}

// candidate-probe-v4-src/lib/canonical-model.ts
var provenance = (seed, sourceField) => [{ ...seed, sourceField }];
function knownValue(published, normalized, seed, sourceField) {
  return { status: "known", published, normalized, provenance: provenance(seed, sourceField) };
}
function derivedValue(normalized, seed, rule) {
  return { status: "known", published: null, normalized, provenance: provenance(seed, `VIGIA:${rule}`) };
}
function missingValue(status = "not_published") {
  return { status, published: null, normalized: null, provenance: [] };
}
function textValue(published, normalized, seed, sourceField, missing = "not_published") {
  const original = typeof published === "string" ? published.trim() : "";
  const value = typeof normalized === "string" ? normalized.trim() : "";
  return original && value ? knownValue(original, value, seed, sourceField) : missingValue(missing);
}
var sourceScopedId = (source, sourceRecordId) => `${source === "SAFETY GATE" ? "sg" : source.toLowerCase()}:${sourceRecordId.trim()}`;
async function hashPayload(value) {
  const bytes2 = new TextEncoder().encode(JSON.stringify(value));
  const digest2 = await crypto.subtle.digest("SHA-256", bytes2);
  return [...new Uint8Array(digest2)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
var comparableCanonical = (alert) => ({
  identity: alert.identity,
  headline: alert.headline,
  dates: { publishedAt: alert.dates.publishedAt, officialUpdatedAt: null },
  lifecycle: alert.lifecycle,
  product: alert.product,
  operators: alert.operators,
  geography: alert.geography,
  risk: alert.risk,
  resources: alert.resources
});
async function canonicalContentHash(alert) {
  return hashPayload(comparableCanonical(alert));
}
var placeholder = (value) => /^(no indicado|no especificado|sin clasificar|consultar(?:\s+la)?\s+(?:publicaci[oó]n|ficha|fuente|riesgo|medidas|alcance)|safety gate · uni[oó]n europea)/i.test(value.trim());
function canonicalFromLegacy(alert) {
  const seed = { source: alert.source, sourceRecordId: alert.reference, officialUrl: alert.url };
  const textOrMissing = (value, field) => placeholder(value) || !value.trim() ? missingValue() : knownValue(value, value, seed, field);
  const brand = textOrMissing(alert.brand, "brand");
  const provider = textOrMissing(alert.provider, "provider");
  return {
    identity: { internalId: alert.id, source: alert.source, sourceRecordId: alert.reference, officialReference: alert.reference, officialUrl: alert.url },
    headline: textOrMissing(alert.title, "title"),
    dates: {
      publishedAt: alert.publishedAt ? knownValue(alert.publishedAt, alert.publishedAt, seed, "publishedAt") : missingValue(),
      detectedAt: alert.detectedAt,
      officialUpdatedAt: alert.updatedAt ? knownValue(alert.updatedAt, alert.updatedAt, seed, "updatedAt") : missingValue("unknown")
    },
    lifecycle: { officialUpdate: derivedValue(alert.isUpdate, seed, "legacy-is-update") },
    product: {
      name: textOrMissing(alert.product, "product"),
      category: textOrMissing(alert.productClass, "productClass"),
      domain: alert.type,
      model: missingValue(),
      commercialReference: missingValue(),
      lots: alert.lots.length ? knownValue(alert.lots, alert.lots, seed, "lots") : missingValue(),
      identifiers: []
    },
    operators: [
      ...brand.status === "known" ? [{ role: "brand", name: brand, evidence: null }] : [],
      ...provider.status === "known" && alert.providerRole ? [{
        role: alert.providerRole.toLowerCase() === "fabricante" ? "manufacturer" : alert.providerRole.toLowerCase() === "distribuidor" ? "distributor" : alert.providerRole.toLowerCase() === "importador" ? "importer" : "other",
        name: provider,
        evidence: alert.providerEvidence || null
      }] : []
    ],
    geography: {
      originCountry: textOrMissing(alert.origin, "origin"),
      notifyingCountry: missingValue(),
      affectedTerritories: missingValue(),
      distribution: textOrMissing(alert.scope, "scope")
    },
    risk: {
      type: textOrMissing(alert.hazard, "hazard").status === "known" ? knownValue([alert.hazard], [alert.hazard], seed, "hazard") : missingValue(),
      hazard: textOrMissing(alert.hazard, "hazard"),
      description: missingValue(),
      reason: missingValue(),
      measures: missingValue(),
      recommendations: textOrMissing(alert.action, "action"),
      priority: knownValue(alert.priority, alert.priority, seed, "priority")
    },
    resources: [
      { kind: "official_page", url: alert.url, label: "Fuente oficial" },
      ...alert.imageUrl ? [{ kind: "image", url: alert.imageUrl, label: null }] : []
    ],
    sourceRecord: {
      legacy: true,
      reference: alert.reference,
      title: alert.title,
      product: alert.product,
      brand: alert.brand,
      productClass: alert.productClass,
      provider: alert.provider,
      providerRole: alert.providerRole,
      providerEvidence: alert.providerEvidence,
      hazard: alert.hazard,
      origin: alert.origin,
      scope: alert.scope,
      action: alert.action,
      lots: alert.lots,
      imageUrl: alert.imageUrl,
      url: alert.url,
      publishedAt: alert.publishedAt,
      updatedAt: alert.updatedAt,
      priority: alert.priority,
      isUpdate: alert.isUpdate
    }
  };
}
function ensureCanonicalAlert(alert) {
  if (alert.canonical?.identity?.internalId) return alert;
  return { ...alert, canonical: canonicalFromLegacy(alert) };
}

// candidate-probe-v4-src/lib/geography/spain-territorial.ts
var normalize = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/gu, " ").trim();
var subdivisionDefinitions = [
  ["ES-AN", "Andaluc\xEDa", ["Andaluc\xEDa", "Junta de Andaluc\xEDa", "Junta Andaluc\xEDa"]],
  ["ES-AR", "Arag\xF3n", ["Arag\xF3n", "Gobierno de Arag\xF3n", "Gobierno Arag\xF3n"]],
  ["ES-AS", "Principado de Asturias", ["Asturias", "Principado de Asturias", "Principado Asturias", "Gobierno del Principado de Asturias"]],
  ["ES-IB", "Illes Balears", ["Illes Balears", "Islas Baleares", "Baleares", "Gobierno Balear", "Govern de les Illes Balears"]],
  ["ES-CN", "Canarias", ["Canarias", "Islas Canarias", "Gobierno de Canarias"]],
  ["ES-CB", "Cantabria", ["Cantabria", "Gobierno de Cantabria"]],
  ["ES-CL", "Castilla y Le\xF3n", ["Castilla y Le\xF3n", "Junta de Castilla y Le\xF3n", "Junta Castilla y Le\xF3n"]],
  ["ES-CM", "Castilla-La Mancha", ["Castilla-La Mancha", "Castilla La Mancha", "Junta de Comunidades de Castilla-La Mancha", "Junta Comunidades Castilla-La Mancha", "Junta de Castilla-La Mancha"]],
  ["ES-CT", "Catalu\xF1a", ["Catalu\xF1a", "Catalunya", "Generalidad de Catalu\xF1a", "Generalitat de Catalunya", "Ag\xE8ncia Catalana del Consum"]],
  ["ES-CE", "Ceuta", ["Ceuta", "Ciudad Aut\xF3noma de Ceuta"]],
  ["ES-ML", "Melilla", ["Melilla", "Ciudad Aut\xF3noma de Melilla"]],
  ["ES-VC", "Comunitat Valenciana", ["Comunitat Valenciana", "Comunidad Valenciana", "Generalitat Valenciana"]],
  ["ES-EX", "Extremadura", ["Extremadura", "Junta de Extremadura", "Junta Extremadura"]],
  ["ES-GA", "Galicia", ["Galicia", "Xunta de Galicia", "Xunta Galicia", "Instituto Gallego del Consumo y de la Competencia"]],
  ["ES-MD", "Comunidad de Madrid", ["Madrid", "Comunidad de Madrid"]],
  ["ES-MC", "Regi\xF3n de Murcia", ["Murcia", "Regi\xF3n de Murcia", "Regi\xF3n Murcia", "Comunidad Aut\xF3noma de la Regi\xF3n de Murcia"]],
  ["ES-NC", "Comunidad Foral de Navarra", ["Navarra", "Comunidad Foral de Navarra", "Gobierno de Navarra", "Gobierno Navarra"]],
  ["ES-PV", "Pa\xEDs Vasco", ["Pa\xEDs Vasco", "Pa\xEDs Vasco - Euskadi", "Euskadi", "Gobierno Vasco", "Eusko Jaurlaritza"]],
  ["ES-RI", "La Rioja", ["La Rioja", "Gobierno de La Rioja", "Gobierno La Rioja"]]
];
var SPAIN_SUBDIVISIONS = subdivisionDefinitions.map(([code, label]) => ({ code, label }));
var aliasEntries = subdivisionDefinitions.flatMap(([code, label, aliases]) => aliases.map((alias) => ({ alias, normalized: normalize(alias), code, label })));
var aliasesByNormalized = new Map(aliasEntries.map((entry) => [entry.normalized, entry]));
var scanAliases = [...aliasEntries].sort((left, right) => right.normalized.length - left.normalized.length);
var codesMentioned = (value) => {
  const normalized = ` ${normalize(value)} `;
  return [...new Set(scanAliases.flatMap((entry) => normalized.includes(` ${entry.normalized} `) ? [entry.code] : []))];
};
var resolveSpainSubdivisionMention = (value) => {
  const clean = value.trim();
  const codes2 = codesMentioned(clean);
  if (codes2.length !== 1) return { status: codes2.length > 1 ? "ambiguous" : "unmapped", value: clean };
  const definition = SPAIN_SUBDIVISIONS.find((item) => item.code === codes2[0]);
  return { status: "mapped", code: definition.code, label: definition.label, value: definition.label };
};
function resolveSpainSubdivision(value) {
  const clean = value.trim();
  const exact = aliasesByNormalized.get(normalize(clean));
  if (exact) return { status: "mapped", code: exact.code, label: exact.label, value: clean };
  return { status: codesMentioned(clean).length > 1 ? "ambiguous" : "unmapped", value: clean };
}
function resolveRapnaNotifyingSubdivision(value) {
  return resolveSpainSubdivision(value.replace(/^Notificado por\s+/iu, "").trim());
}
var sentenceContaining = (value, pattern) => value.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜ])/u).map((sentence) => sentence.trim()).find((sentence) => pattern.test(sentence)) ?? "";
var distributionPattern = /\b(?:distribuci[oó]n\s+(?:inicial|del producto)|(?:el |los )?productos?\s+(?:se\s+)?ha(?:n)?\s+distribuido|(?:el |los )?productos?\s+ha(?:n)?\s+sido\s+distribuido)/iu;
var nationalDistributionPattern = /\b(?:distribuci[oó]n\s+nacional|(?:casi\s+)?todo\s+el\s+territorio\s+nacional)\b/iu;
function extractAesanDistribution(value) {
  const sentence = sentenceContaining(value, distributionPattern);
  if (!sentence) return { subdivisions: [], national: false, matched: false, ambiguous: false };
  if (nationalDistributionPattern.test(sentence)) {
    return { subdivisions: [], national: true, matched: true, ambiguous: false };
  }
  const codes2 = codesMentioned(sentence);
  const subdivisions = codes2.map((code) => {
    const definition = SPAIN_SUBDIVISIONS.find((item) => item.code === code);
    return { code: definition.code, label: definition.label };
  });
  const ambiguous = subdivisions.length === 0 && /\bcomunidad(?:es)?\s+aut[oó]noma(?:s)?\b/iu.test(sentence);
  return { subdivisions, national: false, matched: true, ambiguous };
}
var aesanNotifyingPatterns = [
  /\bnotificaci[oó]n\s+de\s+alerta\s+trasladada\s+por\s+las\s+autoridades\s+sanitarias(?:\s+de)?\s+[\s\S]+/iu,
  /\b(?:agencia\s+espa[nñ]ola\s+de\s+seguridad\s+alimentaria\s+y\s+nutrici[oó]n|AESAN)\b[\s\S]{0,180}\bha\s+sido\s+informada\s+por\s+[\s\S]+/iu,
  /\b(?:comunidad\s+(?:aut[oó]noma\s+de|valenciana)|autoridades\s+(?:competentes|sanitarias)\s+de)\b[\s\S]{0,300}\bha(?:n)?\s+informado\s+a\s+(?:la\s+)?(?:agencia\s+espa[nñ]ola\s+de\s+seguridad\s+alimentaria(?:\s+y\s+nutrici[oó]n)?|AESAN)\b/iu
];
function extractAesanNotifyingSubdivision(value) {
  const sentence = sentenceContaining(value, new RegExp(aesanNotifyingPatterns.map((pattern) => pattern.source).join("|"), "iu"));
  if (!sentence || !aesanNotifyingPatterns.some((pattern) => pattern.test(sentence))) return null;
  return resolveSpainSubdivisionMention(sentence);
}

// candidate-probe-v4-src/lib/recurrence.ts
var normalizeEntityKey = (value = "") => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\b(?:s\.?l\.?u?|s\.?a\.?u?|s\.?c\.?|sociedad limitada|sociedad anonima)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

// candidate-probe-v4-src/lib/source-links.ts
var AESAN_SEARCH_URL = "https://www.aesan.gob.es/alertas/buscador-alertas";
function isOfficialAesanAlertUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const officialHost = url.hostname === "aesan.gob.es" || url.hostname.endsWith(".aesan.gob.es");
    const currentAlert = /^\/alertas\/(?!buscador-alertas(?:\/|$)|alertas-alimentarias(?:\/|$))[^/?#]+/i.test(url.pathname);
    const legacyAlert = /^\/AECOSAN\/web\/seguridad_alimentaria\/(?:alertas_alimentarias|ampliacion)\/(?!listado\/)[^/?#]+\.htm$/i.test(url.pathname);
    return url.protocol === "https:" && officialHost && (currentAlert || legacyAlert);
  } catch {
    return false;
  }
}

// candidate-probe-v4-src/lib/rapna.ts
var RAPNA_PUBLIC_BASE = "https://servicios.consumo.gob.es/rapnaPublic/";
var RAPNA_API_BASE = "https://servicios.consumo.gob.es/rapnaBEPublic/listadoPublico/";
var RAPNA_CURRENT_ENDPOINT = `${RAPNA_API_BASE}notificacion`;
var RAPNA_LEGACY_ENDPOINT = `${RAPNA_API_BASE}notificacionAntigua`;
var RAPNA_DETAIL_ENDPOINT = `${RAPNA_API_BASE}notificacion/`;
var RAPNA_RESOURCE_ENDPOINT = `${RAPNA_API_BASE}fichero`;
var RapnaRequestError = class extends Error {
  constructor(message, kind, status = null) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.name = "RapnaRequestError";
  }
};
var RAPNA_CURRENT_FIELDS = [
  "identificador",
  "nombrePublicacionWeb",
  "categoria.nombre",
  "organoActuante.nombre",
  "organoActuante.descripcion",
  "fechaPublicacion",
  "fechaPublicadaWeb",
  "fechaModificacion",
  "peligroPublicacionWeb",
  "textoPublicacionWeb",
  "medidasPublicacionWeb",
  "ano",
  "ampliacion1.id",
  "ampliacion1.numero",
  "ampliacion1.fechaAlta",
  "ampliacion1.fechaAmpliacion",
  "ampliacion1.motivo",
  "ampliacion1.organo.nombre",
  "ampliacion1.fotografia",
  "ampliacion2.id",
  "ampliacion2.numero",
  "ampliacion2.fechaAlta",
  "ampliacion2.fechaAmpliacion",
  "ampliacion2.motivo",
  "ampliacion2.organo.nombre",
  "ampliacion2.fotografia",
  "ampliacion3.id",
  "ampliacion3.numero",
  "ampliacion3.fechaAlta",
  "ampliacion3.fechaAmpliacion",
  "ampliacion3.motivo",
  "ampliacion3.organo.nombre",
  "ampliacion3.fotografia",
  "observacionPublicacionWeb"
];
var RAPNA_CURRENT_COLUMNS = RAPNA_CURRENT_FIELDS.map((field) => `, T0.${field}`).join("");
var defaultSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
var retryableStatus = (status) => status === 408 || status === 425 || status === 429 || status >= 500;
var stringValue = (value) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
var numberValue = (value) => value === null || value === void 0 || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
var uniqueStrings = (values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "es"));
function rapnaNotifyingAuthorityFromSourceRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const sourceRecord = value;
  const structured = stringValue(sourceRecord.notifyingAuthority);
  const structuredField = stringValue(sourceRecord.notifyingAuthoritySourceField);
  if (structured && structuredField) return { value: structured, sourceField: structuredField };
  const raw = sourceRecord.record;
  if (Array.isArray(raw)) {
    const tail = raw.slice(raw.length - RAPNA_CURRENT_FIELDS.length);
    const values = Object.fromEntries(RAPNA_CURRENT_FIELDS.map((field, index2) => [field, tail[index2]]));
    const name = stringValue(values["organoActuante.nombre"]);
    const description2 = stringValue(values["organoActuante.descripcion"]);
    if (name) return { value: name, sourceField: "organoActuante.nombre" };
    if (description2) return { value: description2, sourceField: "organoActuante.descripcion" };
  }
  if (raw && typeof raw === "object") {
    const rawRecord = raw;
    const name = stringValue(rawRecord["organoActuante.nombre"]);
    const description2 = stringValue(rawRecord["organoActuante.descripcion"]);
    if (name) return { value: name, sourceField: "organoActuante.nombre" };
    if (description2) return { value: description2, sourceField: "organoActuante.descripcion" };
    const authority = stringValue(rawRecord.organoActuante);
    if (authority) return { value: authority, sourceField: "organoActuante" };
  }
  return null;
}
var isoDate = (value) => {
  const clean = value.trim();
  if (!clean) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return `${clean}T00:00:00.000Z`;
  const parsed = Date.parse(clean);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
};
var retryDelay = (response, attempt) => {
  const header = response?.headers.get("Retry-After")?.trim() ?? "";
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1e3, 1e4);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), 1e4);
  return 300 * (attempt + 1);
};
async function requestJson(url, init, client = {}) {
  const fetchImpl = client.fetchImpl ?? fetch;
  const sleep = client.sleep ?? defaultSleep;
  const retries = Math.max(0, Math.min(4, client.retries ?? 2));
  const timeoutMs = Math.max(1e3, client.timeoutMs ?? 25e3);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response = null;
    try {
      response = await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "Accept": "application/json", ...init?.headers ?? {} }
      });
      if (!response.ok) {
        const error = new RapnaRequestError(`RAPNA respondi\xF3 con estado ${response.status}`, "http", response.status);
        if (!retryableStatus(response.status) || attempt === retries) throw error;
        lastError = error;
        await sleep(retryDelay(response, attempt));
        continue;
      }
      try {
        return await response.json();
      } catch (error) {
        throw new RapnaRequestError(
          `RAPNA devolvi\xF3 JSON inv\xE1lido: ${error instanceof Error ? error.message : "respuesta ilegible"}`,
          "invalid-response"
        );
      }
    } catch (error) {
      if (error instanceof RapnaRequestError && (error.kind === "invalid-response" || !retryableStatus(error.status ?? 0))) throw error;
      lastError = error;
      if (attempt === retries) {
        const timeout = error instanceof Error && /abort|timeout/i.test(`${error.name} ${error.message}`);
        throw error instanceof RapnaRequestError ? error : new RapnaRequestError(
          timeout ? "RAPNA agot\xF3 el tiempo de respuesta" : "No se pudo conectar con RAPNA",
          timeout ? "timeout" : "network"
        );
      }
      await sleep(retryDelay(response, attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new RapnaRequestError("RAPNA no respondi\xF3", "network");
}
var postListing = (endpoint, body, client) => requestJson(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
}, client);
var parsePageMetadata = (value) => {
  const content = Array.isArray(value.content) ? value.content : null;
  const totalElements = numberValue(value.totalElements);
  const totalPages = numberValue(value.totalPages);
  const number2 = numberValue(value.number);
  const size = numberValue(value.size);
  if (!content || totalElements === null || totalPages === null || number2 === null || size === null) {
    throw new RapnaRequestError("RAPNA devolvi\xF3 una p\xE1gina sin metadatos de paginaci\xF3n v\xE1lidos", "invalid-response");
  }
  return {
    content,
    totalElements,
    totalPages,
    number: number2,
    size,
    first: value.first === true,
    last: value.last === true,
    empty: value.empty === true
  };
};
var expansionFrom = (values, index2) => {
  const prefix = `ampliacion${index2}.`;
  const expansion = {
    id: numberValue(values[`${prefix}id`]),
    number: stringValue(values[`${prefix}numero`]),
    createdAt: stringValue(values[`${prefix}fechaAlta`]),
    publishedAt: stringValue(values[`${prefix}fechaAmpliacion`]),
    reason: stringValue(values[`${prefix}motivo`]),
    notifyingBody: stringValue(values[`${prefix}organo.nombre`]),
    imageFile: stringValue(values[`${prefix}fotografia`])
  };
  return Object.values(expansion).some((value) => value !== "" && value !== null) ? expansion : null;
};
function parseRapnaCurrentPage(payload) {
  if (!payload || typeof payload !== "object") throw new RapnaRequestError("RAPNA no devolvi\xF3 un objeto de p\xE1gina", "invalid-response");
  const metadata = parsePageMetadata(payload);
  const content = metadata.content.map((candidate) => {
    if (!Array.isArray(candidate) || candidate.length < RAPNA_CURRENT_FIELDS.length + 3) {
      throw new RapnaRequestError("RAPNA devolvi\xF3 una fila actual incompleta", "invalid-response");
    }
    const tail = candidate.slice(candidate.length - RAPNA_CURRENT_FIELDS.length);
    const values = Object.fromEntries(RAPNA_CURRENT_FIELDS.map((field, index2) => [field, tail[index2]]));
    const id = numberValue(candidate[0]);
    if (id === null) throw new RapnaRequestError("RAPNA devolvi\xF3 una fila actual sin identificador interno", "invalid-response");
    return {
      archive: "current",
      id,
      reference: stringValue(values.identificador),
      year: numberValue(values.ano),
      imageFile: stringValue(candidate[2]),
      product: stringValue(values.nombrePublicacionWeb),
      category: stringValue(values["categoria.nombre"]),
      notifyingBodyName: stringValue(values["organoActuante.nombre"]),
      notifyingBodyDescription: stringValue(values["organoActuante.descripcion"]),
      publicationDate: stringValue(values.fechaPublicacion),
      webPublishedDate: stringValue(values.fechaPublicadaWeb),
      modificationDate: stringValue(values.fechaModificacion),
      risk: stringValue(values.peligroPublicacionWeb),
      riskDescription: stringValue(values.textoPublicacionWeb),
      measures: stringValue(values.medidasPublicacionWeb),
      publicObservation: stringValue(values.observacionPublicacionWeb),
      expansions: [expansionFrom(values, 1), expansionFrom(values, 2), expansionFrom(values, 3)].filter((value) => Boolean(value)),
      raw: candidate
    };
  });
  return { ...metadata, content };
}
function parseRapnaLegacyPage(payload) {
  if (!payload || typeof payload !== "object") throw new RapnaRequestError("RAPNA no devolvi\xF3 un objeto de archivo", "invalid-response");
  const metadata = parsePageMetadata(payload);
  const content = metadata.content.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new RapnaRequestError("RAPNA devolvi\xF3 una fila hist\xF3rica inv\xE1lida", "invalid-response");
    }
    const row = candidate;
    const id = numberValue(row.id);
    const year = numberValue(row.ano);
    if (id === null || year === null) throw new RapnaRequestError("RAPNA devolvi\xF3 una fila hist\xF3rica sin identidad", "invalid-response");
    return {
      archive: "legacy",
      id,
      number: stringValue(row.numero),
      year,
      reference: stringValue(row.identificador),
      indexedAt: stringValue(row.fechaAlta),
      product: stringValue(row.nombre),
      documentFile: stringValue(row.documento),
      imageFile: stringValue(row.imagen),
      category: stringValue(row.categoria),
      notifyingBody: stringValue(row.organoActuante),
      published: row.publicada === true,
      raw: row
    };
  });
  return { ...metadata, content };
}
var productLabel = /(?:^|,|;)\s*(marca|modelos?|mod\.?|ref(?:erencia)?s?\.?|lotes?|c[oó]digo\s+de\s+barras|c\.?b\.?)\s*:?[ \t]*/giu;
function parseRapnaProduct(value) {
  const matches = [...value.matchAll(productLabel)];
  const name = (matches[0] ? value.slice(0, matches[0].index) : value).replace(/[\s,;.-]+$/u, "").trim();
  const result = { name: name || value.trim(), brand: "", model: "", commercialReference: "", lots: [], identifiers: [], evidence: {} };
  for (let index2 = 0; index2 < matches.length; index2 += 1) {
    const match = matches[index2];
    const label = match[1].toLocaleLowerCase("es").replaceAll(".", "");
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index2 + 1]?.index ?? value.length;
    const published = value.slice(start, end).replace(/^[\s,:;-]+|[\s,;.-]+$/gu, "").trim();
    if (!published) continue;
    const evidence = value.slice(match.index ?? 0, end).replace(/^[\s,;]+|[\s,;]+$/gu, "").trim();
    if (label === "marca" && !/^sin\s+marca$/iu.test(published) && !result.brand) {
      result.brand = published;
      result.evidence.brand = evidence;
    } else if ((label === "modelo" || label === "modelos" || label === "mod") && !result.model) {
      result.model = published;
      result.evidence.model = evidence;
    } else if ((label === "ref" || label === "refs" || label === "referencia" || label === "referencias") && !result.commercialReference) {
      result.commercialReference = published;
      result.evidence.commercialReference = evidence;
    } else if (label === "lote" || label === "lotes") {
      result.lots.push(published);
      result.evidence.lots = evidence;
    } else if (label === "c\xF3digo de barras" || label === "cb") {
      result.identifiers.push({ kind: "barcode", value: published, published });
      result.evidence.identifiers = evidence;
    }
  }
  result.lots = uniqueStrings(result.lots);
  return result;
}
var explicitOperatorPattern = /(?:^|,|;)\s*(fabricante|importador|distribuidor|proveedor)\s*:?[ \t]*([^,;()]+)/giu;
var operatorRoles = {
  fabricante: "manufacturer",
  importador: "importer",
  distribuidor: "distributor",
  proveedor: "supplier"
};
var explicitOperators = (publishedProduct, seed) => [...publishedProduct.matchAll(explicitOperatorPattern)].flatMap((match) => {
  const name = match[2].trim();
  if (!name) return [];
  return [{
    role: operatorRoles[match[1].toLocaleLowerCase("es")],
    name: knownValue(name, name, seed, `producto:${match[1].toLocaleLowerCase("es")}`),
    evidence: match[0].replace(/^[\s,;]+/u, "").trim()
  }];
});
var officialUrlFor = (record7) => record7.archive === "current" ? `${RAPNA_PUBLIC_BASE}#/public/notificacion/${record7.id}` : `${RAPNA_PUBLIC_BASE}#/public/antiguas`;
var rapnaResourceUrl = (archive, id, file, kind, expansionId) => {
  const query = new URLSearchParams({ archive, id: String(id), file, kind });
  if (expansionId != null) query.set("expansionId", String(expansionId));
  return `/api/rapna/resource?${query.toString()}`;
};
var splitMeasures = (value) => uniqueStrings(value.split(/\s*,\s*|\s*;\s*|\r?\n/gu));
var minDate = (current, candidate) => !candidate ? current : !current || candidate < current ? candidate : current;
var maxDate = (current, candidate) => !candidate ? current : !current || candidate > current ? candidate : current;
async function normalizeRapnaRecord(record7, detectedAt = (/* @__PURE__ */ new Date()).toISOString(), duplicateSourceRecords = []) {
  const reference = record7.reference.trim();
  if (!reference || !record7.product.trim() || !record7.category.trim()) {
    throw new RapnaRequestError(`El registro RAPNA ${record7.id} no contiene referencia, producto o categor\xEDa`, "data-missing");
  }
  if (record7.archive === "current" && (!record7.risk || !record7.riskDescription || !record7.measures)) {
    throw new RapnaRequestError(`La ficha p\xFAblica RAPNA ${reference} lleg\xF3 sin riesgo, descripci\xF3n o medidas`, "data-missing");
  }
  const officialUrl2 = officialUrlFor(record7);
  const id = sourceScopedId("RAPNA", reference);
  const seed = { source: "RAPNA", sourceRecordId: reference, officialUrl: officialUrl2 };
  const parsedProduct = parseRapnaProduct(record7.product);
  const brandOperator = parsedProduct.brand ? [{
    role: "brand",
    name: knownValue(parsedProduct.brand, parsedProduct.brand, seed, "producto:marca"),
    evidence: parsedProduct.evidence.brand ?? null
  }] : [];
  const operators = [...brandOperator, ...explicitOperators(record7.product, seed)].filter((operator, index2, all) => all.findIndex((candidate) => candidate.role === operator.role && candidate.name.normalized?.toLocaleLowerCase("es") === operator.name.normalized?.toLocaleLowerCase("es")) === index2).sort((left, right) => `${left.role}:${left.name.normalized}`.localeCompare(`${right.role}:${right.name.normalized}`, "es"));
  const publicationSource = record7.archive === "current" ? record7.publicationDate || record7.webPublishedDate : record7.indexedAt;
  const publishedAt = isoDate(publicationSource);
  const updatedAt = record7.archive === "current" ? isoDate(record7.modificationDate) || publishedAt : publishedAt;
  const notifier = record7.archive === "current" ? record7.notifyingBodyDescription || record7.notifyingBodyName : record7.notifyingBody;
  const notifyingAuthority = record7.archive === "current" ? record7.notifyingBodyName || record7.notifyingBodyDescription : record7.notifyingBody;
  const notifyingAuthoritySourceField = record7.archive === "current" ? record7.notifyingBodyName ? "organoActuante.nombre" : "organoActuante.descripcion" : "organoActuante";
  const risk = record7.archive === "current" ? record7.risk : "";
  const measures2 = record7.archive === "current" ? splitMeasures(record7.measures) : [];
  const isUpdate = record7.archive === "current" ? record7.expansions.length > 0 : /-A\d+$/iu.test(reference);
  const priority = "Media";
  const resources = [
    { kind: "official_page", url: officialUrl2, label: record7.archive === "current" ? "Ficha oficial RAPNA" : "Archivo oficial RAPNA" },
    ...record7.imageFile ? [{
      kind: "image",
      url: rapnaResourceUrl(record7.archive, record7.id, record7.imageFile, "image"),
      label: "Imagen oficial RAPNA"
    }] : [],
    ...record7.archive === "legacy" && record7.documentFile ? [{
      kind: "document",
      url: rapnaResourceUrl("legacy", record7.id, record7.documentFile, "document"),
      label: `Ficha oficial ${record7.reference}`
    }] : [],
    ...record7.archive === "current" ? record7.expansions.flatMap((expansion) => expansion.imageFile ? [{
      kind: "image",
      url: rapnaResourceUrl("current", record7.id, expansion.imageFile, "image", expansion.id),
      label: "Imagen oficial de ampliaci\xF3n RAPNA"
    }] : []) : []
  ];
  const canonical = {
    identity: { internalId: id, source: "RAPNA", sourceRecordId: reference, officialReference: reference, officialUrl: officialUrl2 },
    headline: knownValue(record7.product, record7.product, seed, record7.archive === "current" ? "nombrePublicacionWeb" : "nombre"),
    dates: {
      publishedAt: record7.archive === "current" ? textValue(publicationSource, publishedAt, seed, record7.publicationDate ? "fechaPublicacion" : "fechaPublicadaWeb", "unknown") : publishedAt ? derivedValue(publishedAt, seed, "legacy-fecha-alta-as-index-date") : missingValue("unknown"),
      detectedAt,
      officialUpdatedAt: record7.archive === "current" ? textValue(record7.modificationDate, updatedAt, seed, "fechaModificacion", "unknown") : missingValue("not_published")
    },
    lifecycle: { officialUpdate: derivedValue(isUpdate, seed, record7.archive === "current" ? "published-expansion-presence" : "legacy-reference-amendment") },
    product: {
      name: knownValue(record7.product, parsedProduct.name, seed, record7.archive === "current" ? "nombrePublicacionWeb" : "nombre"),
      category: knownValue(record7.category, record7.category, seed, record7.archive === "current" ? "categoria.nombre" : "categoria"),
      domain: "No alimentaci\xF3n",
      model: parsedProduct.model ? knownValue(parsedProduct.model, parsedProduct.model, seed, "producto:modelo") : missingValue(),
      commercialReference: parsedProduct.commercialReference ? knownValue(parsedProduct.commercialReference, parsedProduct.commercialReference, seed, "producto:referencia-comercial") : missingValue(),
      lots: parsedProduct.lots.length ? knownValue(parsedProduct.lots, parsedProduct.lots, seed, "producto:lote") : missingValue(),
      identifiers: parsedProduct.identifiers
    },
    operators,
    geography: {
      originCountry: missingValue(),
      notifyingCountry: missingValue(),
      affectedTerritories: missingValue(),
      distribution: missingValue()
    },
    risk: {
      type: risk ? knownValue([risk], [risk], seed, "peligroPublicacionWeb") : missingValue(),
      hazard: risk ? knownValue(risk, risk, seed, "peligroPublicacionWeb") : missingValue(),
      description: record7.archive === "current" ? knownValue(record7.riskDescription, record7.riskDescription, seed, "textoPublicacionWeb") : missingValue(),
      reason: missingValue(),
      measures: measures2.length ? knownValue(measures2, measures2, seed, "medidasPublicacionWeb") : missingValue(),
      recommendations: missingValue(),
      priority: derivedValue(priority, seed, "neutral-priority-until-source-severity")
    },
    resources,
    sourceRecord: {
      archive: record7.archive,
      record: record7.raw,
      notifyingAuthority,
      notifyingAuthoritySourceField,
      ...duplicateSourceRecords.length ? { duplicateSourceRecords: duplicateSourceRecords.map((duplicate) => duplicate.raw) } : {}
    }
  };
  const contentHash = await canonicalContentHash(canonical);
  const provider = operators.find((operator) => operator.role !== "brand");
  const imageUrl = resources.find((resource) => resource.kind === "image")?.url ?? null;
  return {
    id,
    reference,
    source: "RAPNA",
    type: "No alimentaria",
    priority,
    title: record7.product,
    product: parsedProduct.name,
    brand: parsedProduct.brand,
    productClass: record7.category,
    productKey: normalizeEntityKey(parsedProduct.name),
    brandKey: normalizeEntityKey(parsedProduct.brand),
    provider: provider?.name.normalized ?? "",
    providerKey: normalizeEntityKey(provider?.name.normalized ?? ""),
    providerRole: provider ? { brand: "Marca", manufacturer: "Fabricante", importer: "Importador", distributor: "Distribuidor", supplier: "Proveedor", retailer: "Minorista", other: "Otro" }[provider.role] ?? "" : "",
    providerEvidence: provider?.evidence ?? "",
    hazard: risk || "Consultar el documento oficial RAPNA",
    origin: "No indicado",
    scope: notifier ? `Notificado por ${notifier}` : "RAPNA \xB7 Espa\xF1a",
    action: measures2.length ? measures2.join(" \xB7 ") : "Consultar el documento oficial RAPNA",
    lots: parsedProduct.lots,
    imageUrl,
    url: officialUrl2,
    publishedAt: publishedAt || null,
    detectedAt,
    updatedAt: updatedAt || publishedAt || detectedAt,
    contentHash,
    versionCount: 1,
    isUpdate,
    canonical
  };
}
var newerRecord = (left, right) => {
  const leftDate = left.archive === "current" ? left.modificationDate || left.webPublishedDate : left.indexedAt;
  const rightDate = right.archive === "current" ? right.modificationDate || right.webPublishedDate : right.indexedAt;
  return rightDate.localeCompare(leftDate) || right.id - left.id;
};
function consolidateRapnaRecords(records) {
  const grouped = /* @__PURE__ */ new Map();
  let invalidRecords = 0;
  for (const record7 of records) {
    if (!record7.reference) {
      invalidRecords += 1;
      continue;
    }
    const values = grouped.get(record7.reference) ?? [];
    values.push(record7);
    grouped.set(record7.reference, values);
  }
  const selected = [...grouped.values()].map((values) => {
    const ordered3 = [...values].sort(newerRecord);
    return { record: ordered3[0], duplicates: ordered3.slice(1) };
  }).sort((left, right) => left.record.reference.localeCompare(right.record.reference, "es", { numeric: true }));
  return {
    selected,
    duplicateRecords: selected.reduce((sum, item) => sum + item.duplicates.length, 0),
    invalidRecords
  };
}
async function fetchArchivePages(archive, body, client, pageSize = 250, stopWhen) {
  const records = [];
  const signatures = /* @__PURE__ */ new Set();
  const safetyPageLimit = 100;
  let pagesScanned = 0;
  let declaredTotal = 0;
  for (let pageNumber = 0; pageNumber < safetyPageLimit; pageNumber += 1) {
    const payload = await postListing(archive === "current" ? RAPNA_CURRENT_ENDPOINT : RAPNA_LEGACY_ENDPOINT, {
      ...body,
      pageNumber,
      pageSize,
      ...archive === "current" ? { columnas: RAPNA_CURRENT_COLUMNS } : {}
    }, client);
    const page = archive === "current" ? parseRapnaCurrentPage(payload) : parseRapnaLegacyPage(payload);
    declaredTotal = page.totalElements;
    const signature = page.content.map((record7) => `${record7.id}:${record7.reference}`).join("|");
    if (signature && signatures.has(signature)) throw new RapnaRequestError("RAPNA repiti\xF3 una p\xE1gina y se detuvo para evitar un ciclo", "pagination");
    if (signature) signatures.add(signature);
    records.push(...page.content);
    pagesScanned += 1;
    if (stopWhen?.(page.content, pageNumber)) break;
    const declaredEnd = page.totalPages >= 0 && pageNumber + 1 >= page.totalPages;
    if (!page.content.length || page.last || declaredEnd) break;
    if (pageNumber + 1 === safetyPageLimit) throw new RapnaRequestError(`RAPNA alcanz\xF3 el l\xEDmite de seguridad de ${safetyPageLimit} p\xE1ginas`, "pagination");
  }
  return { records, pagesScanned, declaredTotal };
}
var resultFromRecords = async (records, pagesScanned, detectedAt) => {
  const consolidated = consolidateRapnaRecords(records);
  const normalized = [];
  let invalidRecords = consolidated.invalidRecords;
  for (const item of consolidated.selected) {
    try {
      normalized.push(await normalizeRapnaRecord(item.record, detectedAt, item.duplicates));
    } catch (error) {
      if (error instanceof RapnaRequestError && error.kind === "data-missing") {
        invalidRecords += 1;
        continue;
      }
      throw error;
    }
  }
  let oldestPublishedAt = null;
  let newestPublishedAt = null;
  for (const alert of normalized) {
    oldestPublishedAt = minDate(oldestPublishedAt, alert.publishedAt);
    newestPublishedAt = maxDate(newestPublishedAt, alert.publishedAt);
  }
  return {
    alerts: normalized,
    pagesScanned,
    recordsObserved: records.length,
    duplicateRecords: consolidated.duplicateRecords,
    duplicateReferences: consolidated.selected.filter((item) => item.duplicates.length > 0).map((item) => item.record.reference).sort((left, right) => left.localeCompare(right, "es", { numeric: true })),
    invalidRecords,
    oldestPublishedAt,
    newestPublishedAt
  };
};
async function fetchRapnaRecent(since = null, client = {}, detectedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const boundary = since ? new Date(new Date(since).getTime() - 48 * 60 * 6e4).toISOString() : null;
  const fetched = await fetchArchivePages("current", {
    sortBy: "fechaModificacion",
    sortOrder: "desc"
  }, client, 100, (records, page) => {
    if (!boundary || page === 0 && records.length === 0) return true;
    const oldestModification = records.reduce((oldest, record7) => {
      const current = record7.archive === "current" ? isoDate(record7.modificationDate) : "";
      return minDate(oldest, current || null);
    }, null);
    return Boolean(oldestModification && oldestModification <= boundary);
  });
  return resultFromRecords(fetched.records, fetched.pagesScanned, detectedAt);
}
async function yearBoundary(archive, sortOrder, client) {
  const payload = await postListing(archive === "current" ? RAPNA_CURRENT_ENDPOINT : RAPNA_LEGACY_ENDPOINT, {
    pageNumber: 0,
    pageSize: 1,
    sortBy: "ano",
    sortOrder,
    ...archive === "current" ? { columnas: RAPNA_CURRENT_COLUMNS } : {}
  }, client);
  const page = archive === "current" ? parseRapnaCurrentPage(payload) : parseRapnaLegacyPage(payload);
  return page.content[0]?.year ?? null;
}
async function fetchRapnaLegacyRevisionPlan(client = {}) {
  const [legacyMin, legacyMax] = await Promise.all([
    yearBoundary("legacy", "asc", client),
    yearBoundary("legacy", "desc", client)
  ]);
  if (legacyMin === null || legacyMax === null || legacyMin > legacyMax) {
    throw new RapnaRequestError("RAPNA no permiti\xF3 determinar los l\xEDmites anuales de LEGACY", "invalid-response");
  }
  return Array.from({ length: legacyMax - legacyMin + 1 }, (_, index2) => ({
    archive: "legacy",
    year: legacyMax - index2
  }));
}
async function fetchRapnaCurrentReplayPlan(client = {}) {
  const [currentMin, currentMax] = await Promise.all([
    yearBoundary("current", "asc", client),
    yearBoundary("current", "desc", client)
  ]);
  if (currentMin === null || currentMax === null || currentMin > currentMax) {
    throw new RapnaRequestError("RAPNA no permiti\xF3 determinar los l\xEDmites anuales de CURRENT", "invalid-response");
  }
  return Array.from({ length: currentMax - currentMin + 1 }, (_, index2) => ({
    archive: "current",
    year: currentMin + index2
  }));
}
async function fetchRapnaBackfillUnit(unit, client = {}, detectedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const fetched = await fetchArchivePages(unit.archive, {
    ...unit.archive === "current" ? { anoPublico: String(unit.year) } : { anoAntigua: String(unit.year) },
    sortBy: "identificador",
    sortOrder: "asc"
  }, client, 250);
  if (fetched.records.length !== fetched.declaredTotal) {
    throw new RapnaRequestError(
      `La unidad RAPNA ${unit.archive}:${unit.year} devolvi\xF3 ${fetched.records.length} de ${fetched.declaredTotal} registros`,
      "pagination"
    );
  }
  return resultFromRecords(fetched.records, fetched.pagesScanned, detectedAt);
}

// candidate-probe-v4-src/lib/dimensions/canonical-dimensions.ts
var DIMENSION_MAPPING_VERSION = "work19g-j-v4";
var SAFETY_GATE_DIMENSION_MAPPING_VERSION = "work19g-ai-v6";
var RASFF_DIMENSION_MAPPING_VERSION = "work20q-f1-v1";
var dimensionMappingVersionForSource = (source) => source === "SAFETY GATE" ? SAFETY_GATE_DIMENSION_MAPPING_VERSION : source === "RASFF" ? RASFF_DIMENSION_MAPPING_VERSION : DIMENSION_MAPPING_VERSION;
var normalize2 = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
var record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
var array = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
var string = (value) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
var nested = (value, ...path) => path.reduce((current, key) => record(current)[key], value);
var fieldOf = (value, fallback) => value.provenance[0]?.sourceField ?? fallback;
var categoryMappings = {};
var addCategories = (source, code, values) => {
  for (const value of values) categoryMappings[`${source}|${normalize2(value)}`] = code;
};
addCategories("AESAN", "beverages", ["Bebidas"]);
addCategories("AESAN", "cereals_bakery", ["Cereales, panader\xEDa y pasta"]);
addCategories("AESAN", "condiments", ["Condimentos, salsas y especias"]);
addCategories("AESAN", "confectionery", ["Dulces y confiter\xEDa"]);
addCategories("AESAN", "dairy", ["Leche y productos l\xE1cteos"]);
addCategories("AESAN", "fish_seafood", ["Pescado y marisco"]);
addCategories("AESAN", "food_other", ["Otros alimentos"]);
addCategories("AESAN", "fruit_vegetables", ["Frutas y hortalizas"]);
addCategories("AESAN", "meat", ["Carne y productos c\xE1rnicos"]);
addCategories("AESAN", "nuts_seeds", ["Frutos secos y semillas"]);
addCategories("AESAN", "prepared_foods", ["Platos preparados y sopas"]);
addCategories("AESAN", "supplements", ["Complementos alimenticios"]);
addCategories("RAPNA", "toys", ["Juguetes", "Disfraces y art\xEDculos de broma"]);
addCategories("RAPNA", "electrical", ["Luminarias", "Material el\xE9ctrico", "Peque\xF1os electrodom\xE9sticos", "Punteros l\xE1ser"]);
addCategories("RAPNA", "protective_equipment", ["Equipo de protecci\xF3n individual"]);
addCategories("RAPNA", "childcare", ["Art\xEDculos de puericultura"]);
addCategories("RAPNA", "household", ["Art\xEDculos del hogar"]);
addCategories("RAPNA", "sports", ["Art\xEDculos de ocio/deporte", "Bicicletas y Accesorios"]);
addCategories("RAPNA", "clothing", ["Vestimenta Infantil"]);
addCategories("RAPNA", "vehicles", ["Veh\xEDculos y accesorios"]);
addCategories("RAPNA", "jewellery", ["Bisuter\xEDa y relojes"]);
addCategories("SAFETY GATE", "toys", ["Toys", "TOYS"]);
addCategories("SAFETY GATE", "cosmetics", ["Cosmetics", "COSMETICS"]);
addCategories("SAFETY GATE", "electrical", ["Electrical appliances and equipment", "ELECTRICAL_APPLIANCES", "Lighting chains", "Lighting equipment"]);
addCategories("SAFETY GATE", "vehicles", ["Motor vehicles", "MOTOR_VEHICLES"]);
addCategories("SAFETY GATE", "chemicals", ["Chemical products", "CHEMICAL_PRODUCTS"]);
addCategories("SAFETY GATE", "childcare", ["Childcare articles and children's equipment"]);
addCategories("SAFETY GATE", "clothing", ["Clothing, textiles and fashion items", "CLOTHING_TEXTILES"]);
addCategories("SAFETY GATE", "sports", ["Hobby/sports equipment", "HOBBY_SPORTS_EQUIPMENT"]);
addCategories("SAFETY GATE", "pyrotechnics", ["Pyrotechnic articles", "PYROTECHNIC_ARTICLES"]);
addCategories("SAFETY GATE", "protective_equipment", ["Protective equipment", "PROTECTIVE_EQUIPMENT"]);
addCategories("SAFETY GATE", "machinery", ["Machinery"]);
addCategories("SAFETY GATE", "jewellery", ["Jewellery", "JEWELLERY"]);
addCategories("SAFETY GATE", "household", ["Decorative articles", "DECORATIVE_ARTICLES", "Kitchen/cooking accessories"]);
addCategories("SAFETY GATE", "electrical", ["LASER_POINTERS", "LIGHTING_EQUIPMENT"]);
addCategories("SAFETY GATE", "furniture", ["Furniture", "FURNITURE"]);
addCategories("OECD", "toys", ["Toys/Games", "Consumer products, Toys and games", "Produits de consommation, Jouets et jeux", "TOYS"]);
addCategories("OECD", "cosmetics", [
  "Beauty/Personal Care/Hygiene",
  "COSMETICS",
  "Cosmetics",
  "Cosmetics Products",
  "Consumer products, Beauty and personal care",
  "Produits de consommation, Cosm\xE9tiques et produits de soins personnels"
]);
addCategories("OECD", "electrical", [
  "Electrical Supplies",
  "Electronics and technology, Button batteries",
  "Home Appliances",
  "ELECTRICAL_APPLIANCES",
  "Electrical Appliances",
  "Consumer products, Electronics",
  "Produits de consommation, Produits \xE9lectroniques",
  "Consumer products, Appliances",
  "Produits de consommation, Appareils m\xE9nagers",
  "LIGHTING_EQUIPMENT",
  "LIGHTING_CHAINS"
]);
addCategories("OECD", "vehicles", [
  "Vehicle",
  "Motor Vehicles, Parts & Accessories",
  "MOTOR_VEHICLES",
  "Cars/Vans/Sport Utility Vehicles/Light Trucks"
]);
addCategories("OECD", "furniture", ["Household/Office Furniture/Furnishings", "Chests of Drawers (Dressers)/Drawers"]);
addCategories("OECD", "sports", [
  "Sports Equipment",
  "Consumer products, Sports and fitness",
  "Produits de consommation, Articles de sport et mat\xE9riel de culture physique"
]);
addCategories("OECD", "household", ["Consumer products, Household items", "Produits de consommation, Articles de maison", "Kitchenware and Tableware"]);
addCategories("OECD", "clothing", [
  "CLOTHING_TEXTILES",
  "Clothing",
  "Consumer products, Clothing and accessories, Clothing",
  "Produits de consommation, V\xEAtements et accessoires, V\xEAtements"
]);
addCategories("OECD", "protective_equipment", ["PROTECTIVE_EQUIPMENT", "Lifebelts/Life-Jackets/Lifesuits"]);
addCategories("OECD", "chemicals", [
  "CHEMICAL_PRODUCTS",
  "Consumer products, Chemicals",
  "Produits de consommation, Substances chimiques"
]);
addCategories("OECD", "jewellery", ["JEWELLERY"]);
addCategories("OECD", "childcare", ["CHILDCARE_ARTICLES"]);
addCategories("OECD", "machinery", ["MACHINERY"]);
var hazardAliases = {
  "risk type chemical": "chemical",
  "riesgo quimico": "chemical",
  chemical: "chemical",
  chimique: "chemical",
  "risk type choking": "choking",
  asfixia: "choking",
  choking: "choking",
  "risk type drowning": "drowning",
  ahogamiento: "drowning",
  drowning: "drowning",
  "risk type electric shock": "electrical",
  "descarga electrica": "electrical",
  "choque electrico": "electrical",
  electrical: "electrical",
  "electric shock": "electrical",
  electrocution: "electrical",
  "risk type environment": "environment",
  "riesgo medioambiental": "environment",
  environmental: "environment",
  "risk type fire": "fire",
  incendio: "fire",
  fire: "fire",
  "risk type injuries": "injury",
  lesiones: "injury",
  "lesiones diversas": "injury",
  injuries: "injury",
  injury: "injury",
  "risk type burns": "burns",
  quemaduras: "burns",
  burns: "burns",
  "risk type strangulation": "strangulation",
  estrangulamiento: "strangulation",
  strangulation: "strangulation",
  "riesgo microbiologico": "biological",
  microbiological: "biological",
  "damage to sight": "injury",
  "damage to hearing": "injury",
  "lesiones oculares": "injury",
  cuts: "injury",
  cut: "injury",
  fall: "injury",
  entrapment: "injury",
  asphyxiation: "choking",
  suffocation: "choking",
  "health risk other": "other"
};
var biologicalPattern = /\b(?:salmonella|listeria|campylobacter|escherichia|e\s*coli|hepatitis|norovirus|clostridium|bacillus|cereulida|toxina botulinica)\b/iu;
var allergenPattern = /\b(?:no declarad[oa]s?|alergen|gluten|leche|almendra|cacahuete|soja|sesamo|sulfitos|pescado)\b/iu;
var physicalPattern = /\b(?:fragmentos?|particulas?|cuerpo extrano|vidrio|metal|plastico)\b/iu;
var categoryFor = (alert) => {
  const value = alert.canonical.product.category;
  const rawValue = string(value.published);
  const sourceNormalized = string(value.normalized);
  if (value.status !== "known" || !sourceNormalized) return {
    categoryKey: "unknown",
    rawValue,
    sourceNormalized: "",
    canonicalCode: "",
    status: "unknown",
    sourceField: fieldOf(value, "product.category"),
    evidenceType: "structured_field",
    reason: `source-category-${value.status}`,
    mappingVersion: dimensionMappingVersionForSource(alert.source)
  };
  const code = categoryMappings[`${alert.source}|${normalize2(sourceNormalized)}`];
  return {
    categoryKey: code ? `canonical:${code}` : `unmapped:${normalize2(sourceNormalized)}`,
    rawValue,
    sourceNormalized,
    canonicalCode: code ?? "",
    status: code ? "mapped" : "unmapped",
    sourceField: fieldOf(value, "product.category"),
    evidenceType: "source_category_mapping",
    reason: code ? `exact-${alert.source.toLowerCase().replaceAll(" ", "-")}-category` : "no-certified-category-mapping",
    mappingVersion: dimensionMappingVersionForSource(alert.source)
  };
};
var hazardTokens = (alert) => {
  const riskType = alert.canonical.risk.type;
  const hazard = alert.canonical.risk.hazard;
  const validOecdHazardText = (value) => typeof value === "string" && !/^(?:true|false)$/iu.test(value.trim()) ? value.trim() : "";
  if (alert.source === "OECD") {
    const official = validOecdHazardText(hazard.published);
    const normalized = validOecdHazardText(hazard.normalized);
    const authoritative = official || normalized;
    if (!authoritative) return [];
    const lead = authoritative.split(";")[0]?.trim() ?? "";
    return lead.length > 0 && lead.length <= 80 ? lead.split(/\s*,\s*/u).map((item) => item.trim()).filter(Boolean) : [authoritative];
  }
  const raw = string(hazard.published) || alert.hazard;
  if (riskType.status === "known" && Array.isArray(riskType.normalized)) return riskType.normalized.map(string).filter(Boolean);
  if (alert.source === "RAPNA") return raw.split(/\s*,\s*/u).map((item) => item.trim()).filter(Boolean);
  return raw ? [raw] : [];
};
var hazardCodeFor = (alert, token) => {
  const normalized = normalize2(token).replace(/^risk type /u, "risk type ");
  const exact = hazardAliases[normalized];
  if (exact) return exact;
  if (alert.source === "AESAN") {
    if (biologicalPattern.test(token)) return "biological";
    if (allergenPattern.test(token)) return "allergen";
    if (physicalPattern.test(token)) return "physical";
    if (/\b(?:sildenafilo|tadalafilo|mercurio|cadmio|plomo|pesticida|micotoxina)\b/iu.test(token)) return "chemical";
  }
  return null;
};
var hazardsFor = (alert) => {
  const value = alert.canonical.risk.hazard;
  const tokens = hazardTokens(alert);
  if (!tokens.length || value.status !== "known") return [{
    hazardKey: "unknown",
    rawValue: string(value.published),
    sourceNormalized: "",
    canonicalCode: "",
    status: "unknown",
    sourceField: fieldOf(value, "risk.hazard"),
    evidenceType: "structured_field",
    reason: `source-hazard-${value.status}`,
    mappingVersion: dimensionMappingVersionForSource(alert.source)
  }];
  return tokens.map((token) => {
    const code = hazardCodeFor(alert, token);
    return {
      hazardKey: code ? `canonical:${code}` : `unmapped:${normalize2(token)}`,
      rawValue: string(value.published) || token,
      sourceNormalized: token,
      canonicalCode: code ?? "",
      status: code ? "mapped" : "unmapped",
      sourceField: fieldOf(value, "risk.hazard"),
      evidenceType: "source_hazard_mapping",
      reason: code ? `bounded-${alert.source.toLowerCase().replaceAll(" ", "-")}-hazard` : "no-certified-hazard-mapping",
      mappingVersion: dimensionMappingVersionForSource(alert.source)
    };
  });
};
var isoCodes = new Set("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(/\s+/u));
var legacyStaticCountryAliases = /* @__PURE__ */ new Map([
  ["people s republic of china", "CN"],
  ["china people s republic of", "CN"],
  ["china", "CN"],
  ["estados unidos", "US"],
  ["united states", "US"],
  ["la india", "IN"],
  ["india", "IN"],
  ["paises bajos", "NL"],
  ["netherlands", "NL"],
  ["reino unido", "GB"],
  ["united kingdom", "GB"],
  ["corea republica de", "KR"],
  ["korea republic of", "KR"],
  ["espana", "ES"],
  ["spain", "ES"]
]);
var staticCountryAliases = new Map([
  ...legacyStaticCountryAliases,
  ["albania", "AL"],
  ["australia", "AU"],
  ["austria", "AT"],
  ["bangladesh", "BD"],
  ["belarus", "BY"],
  ["belgium", "BE"],
  ["bhutan", "BT"],
  ["brazil", "BR"],
  ["bulgaria", "BG"],
  ["burkina faso", "BF"],
  ["cambodia", "KH"],
  ["cameroon", "CM"],
  ["canada", "CA"],
  ["chile", "CL"],
  ["colombia", "CO"],
  ["congo", "CG"],
  ["croatia", "HR"],
  ["cyprus", "CY"],
  ["czechia", "CZ"],
  ["denmark", "DK"],
  ["egypt", "EG"],
  ["estonia", "EE"],
  ["ethiopia", "ET"],
  ["finland", "FI"],
  ["france", "FR"],
  ["georgia", "GE"],
  ["germany", "DE"],
  ["ghana", "GH"],
  ["greece", "GR"],
  ["haiti", "HT"],
  ["hungary", "HU"],
  ["iceland", "IS"],
  ["indonesia", "ID"],
  ["ireland", "IE"],
  ["isle of man", "IM"],
  ["israel", "IL"],
  ["italy", "IT"],
  ["japan", "JP"],
  ["kenya", "KE"],
  ["latvia", "LV"],
  ["lebanon", "LB"],
  ["lithuania", "LT"],
  ["luxembourg", "LU"],
  ["madagascar", "MG"],
  ["malaysia", "MY"],
  ["malta", "MT"],
  ["mauritania", "MR"],
  ["mexico", "MX"],
  ["monaco", "MC"],
  ["morocco", "MA"],
  ["nepal", "NP"],
  ["new zealand", "NZ"],
  ["niger", "NE"],
  ["nigeria", "NG"],
  ["north macedonia", "MK"],
  ["norway", "NO"],
  ["pakistan", "PK"],
  ["peru", "PE"],
  ["philippines", "PH"],
  ["poland", "PL"],
  ["portugal", "PT"],
  ["romania", "RO"],
  ["san marino", "SM"],
  ["saudi arabia", "SA"],
  ["senegal", "SN"],
  ["serbia", "RS"],
  ["singapore", "SG"],
  ["slovakia", "SK"],
  ["slovenia", "SI"],
  ["south africa", "ZA"],
  ["sri lanka", "LK"],
  ["sweden", "SE"],
  ["switzerland", "CH"],
  ["syria", "SY"],
  ["taiwan", "TW"],
  ["thailand", "TH"],
  ["togo", "TG"],
  ["tunisia", "TN"],
  ["turkiye", "TR"],
  ["ukraine", "UA"],
  ["united arab emirates", "AE"],
  ["uzbekistan", "UZ"],
  ["vatican city", "VA"],
  ["vietnam", "VN"]
]);
var safetyGateCountryAliases = /* @__PURE__ */ new Map([
  ["united kingdom in respect of northern ireland", "XI"],
  ["hong kong", "HK"],
  ["macao", "MO"],
  ["the netherlands", "NL"],
  ["republic of korea", "KR"],
  ["ivory coast", "CI"],
  ["russian federation", "RU"],
  ["democratic republic of congo", "CD"],
  ["bosnia and herzegovina", "BA"],
  ["swaziland", "SZ"],
  ["lao people s democratic republic", "LA"],
  ["democratic people s republic of korea", "KP"]
]);
var displayCountryAliases = /* @__PURE__ */ new Map();
var displayAliasesReady = false;
var ensureDisplayAliases = () => {
  if (displayAliasesReady) return;
  displayAliasesReady = true;
  for (const locale of ["en", "es", "fr"]) {
    const display = new Intl.DisplayNames([locale], { type: "region" });
    for (const code of isoCodes) {
      const name = display.of(code);
      if (name && name !== code) displayCountryAliases.set(normalize2(name), code);
    }
  }
};
var mappedCountry = (alert, role, input) => {
  if (alert.source !== "SAFETY GATE") ensureDisplayAliases();
  const suppliedCode = (input.code ?? "").trim().toUpperCase();
  const normalizedCandidate = normalize2(input.normalizedValue ?? "");
  const rawCandidate = normalize2(input.rawValue ?? "");
  let code = "";
  let evidenceType = input.evidenceType ?? "structured_field";
  let reason = input.reason;
  if (suppliedCode === "XI" || isoCodes.has(suppliedCode)) {
    code = suppliedCode;
  } else {
    const generalAlias = (value) => alert.source === "SAFETY GATE" ? staticCountryAliases.get(value) : displayCountryAliases.get(value) ?? legacyStaticCountryAliases.get(value);
    const candidates = [
      {
        code: alert.source === "SAFETY GATE" ? safetyGateCountryAliases.get(normalizedCandidate) : void 0,
        evidenceType: "certified_source_alias",
        suffix: "exact-safety-gate-country-alias"
      },
      {
        code: generalAlias(normalizedCandidate),
        evidenceType: "canonical_normalized_value",
        suffix: "exact-canonical-country"
      },
      {
        code: alert.source === "SAFETY GATE" ? safetyGateCountryAliases.get(rawCandidate) : void 0,
        evidenceType: "raw_official_fallback",
        suffix: "exact-raw-safety-gate-country-alias"
      },
      {
        code: generalAlias(rawCandidate),
        evidenceType: "raw_official_fallback",
        suffix: "exact-raw-country"
      }
    ];
    const match = candidates.find((candidate) => candidate.code);
    if (match) {
      code = match.code;
      evidenceType = match.evidenceType;
      reason = `${input.reason}:${match.suffix}`;
    }
  }
  if (code === "XI") return {
    role,
    geographyKey: "EU_COUNTRY:XI",
    geographyCode: "XI",
    codeScheme: "EU_COUNTRY",
    countryCode: "",
    subdivisionCode: "",
    adminLevel: "territory",
    rawValue: input.rawValue,
    source: alert.source,
    sourceField: input.sourceField,
    evidenceType,
    reason,
    status: "mapped",
    mappingVersion: dimensionMappingVersionForSource(alert.source)
  };
  if (!code) return {
    role,
    geographyKey: `unmapped:${normalize2(input.rawValue || input.normalizedValue || suppliedCode) || "unknown-code"}`,
    geographyCode: "",
    codeScheme: "",
    countryCode: "",
    subdivisionCode: "",
    adminLevel: "unknown",
    rawValue: input.rawValue || input.normalizedValue || suppliedCode,
    source: alert.source,
    sourceField: input.sourceField,
    evidenceType: input.evidenceType ?? "structured_field",
    reason: "country-not-unambiguously-mapped",
    status: "unmapped",
    mappingVersion: dimensionMappingVersionForSource(alert.source)
  };
  return {
    role,
    geographyKey: `ISO_3166_1_ALPHA2:${code}`,
    geographyCode: code,
    codeScheme: "ISO_3166_1_ALPHA2",
    countryCode: code,
    subdivisionCode: "",
    adminLevel: "country",
    rawValue: input.rawValue,
    source: alert.source,
    sourceField: input.sourceField,
    evidenceType,
    reason,
    status: "mapped",
    mappingVersion: dimensionMappingVersionForSource(alert.source)
  };
};
var mappedSubdivision = (alert, role, code, rawValue, sourceField, evidenceType, reason) => ({
  role,
  geographyKey: `ISO_3166_2:${code}`,
  geographyCode: code,
  codeScheme: "ISO_3166_2",
  countryCode: "ES",
  subdivisionCode: code,
  adminLevel: "subdivision",
  rawValue,
  source: alert.source,
  sourceField,
  evidenceType,
  reason,
  status: "mapped",
  mappingVersion: dimensionMappingVersionForSource(alert.source)
});
var unresolvedSubdivision = (alert, role, resolution, sourceField, evidenceType, reason) => ({
  role,
  geographyKey: `unmapped:${normalize2(resolution.value) || "unknown-subdivision"}`,
  geographyCode: "",
  codeScheme: "",
  countryCode: "",
  subdivisionCode: "",
  adminLevel: "unknown",
  rawValue: resolution.value,
  source: alert.source,
  sourceField,
  evidenceType,
  reason,
  status: "unmapped",
  mappingVersion: dimensionMappingVersionForSource(alert.source)
});
var aesanNotifyingRelations = (alert) => {
  const notifyingText = string(record(alert.canonical.sourceRecord).notifyingText);
  if (!notifyingText) return [];
  const resolution = extractAesanNotifyingSubdivision(notifyingText);
  if (!resolution) return [unresolvedSubdivision(
    alert,
    "notifying",
    { status: "unmapped", value: notifyingText },
    "notifyingText",
    "official_text",
    "aesan-notifying-wording-not-approved"
  )];
  return resolution.status === "mapped" ? [mappedSubdivision(
    alert,
    "notifying",
    resolution.code,
    notifyingText,
    "notifyingText",
    "source_derived_explicit_evidence",
    "exact-ccaa-in-upstream-validated-aesan-notifying-evidence"
  )] : [unresolvedSubdivision(
    alert,
    "notifying",
    resolution,
    "notifyingText",
    "official_text",
    resolution.status === "ambiguous" ? "aesan-notifying-subdivision-ambiguous" : "aesan-notifying-subdivision-unmapped"
  )];
};
var rapnaNotifyingRelations = (alert) => {
  const authority = rapnaNotifyingAuthorityFromSourceRecord(alert.canonical.sourceRecord);
  if (!authority?.value) return [];
  const resolution = resolveRapnaNotifyingSubdivision(authority.value);
  return resolution.status === "mapped" ? [mappedSubdivision(
    alert,
    "notifying",
    resolution.code,
    authority.value,
    authority.sourceField,
    "structured_official_authority",
    "exact-rapna-notifying-authority-mapping"
  )] : [unresolvedSubdivision(
    alert,
    "notifying",
    resolution,
    authority.sourceField,
    "structured_official_authority",
    resolution.status === "ambiguous" ? "rapna-notifying-authority-ambiguous" : "rapna-notifying-authority-unmapped"
  )];
};
var aesanDistributionRelations = (alert) => {
  const value = alert.canonical.geography.distribution;
  if (value.status !== "known" || !value.published) return [];
  const rawValue = string(value.published);
  const sourceField = fieldOf(value, "geography.distribution");
  const resolution = extractAesanDistribution(rawValue);
  if (!resolution.matched) return [];
  if (resolution.national) return [{
    role: "distribution",
    geographyKey: "ISO_3166_1_ALPHA2:ES",
    geographyCode: "ES",
    codeScheme: "ISO_3166_1_ALPHA2",
    countryCode: "ES",
    subdivisionCode: "",
    adminLevel: "country",
    rawValue,
    source: alert.source,
    sourceField,
    evidenceType: "official_text_national_scope",
    reason: "explicit-aesan-national-distribution",
    status: "mapped",
    mappingVersion: dimensionMappingVersionForSource(alert.source)
  }];
  if (resolution.subdivisions.length) return resolution.subdivisions.map(({ code }) => mappedSubdivision(
    alert,
    "distribution",
    code,
    rawValue,
    sourceField,
    "official_text_enumeration",
    "explicit-autonomous-community-in-aesan-distribution-scope"
  ));
  return [unresolvedSubdivision(alert, "distribution", {
    status: resolution.ambiguous ? "ambiguous" : "unmapped",
    value: rawValue
  }, sourceField, "official_text_enumeration", resolution.ambiguous ? "aesan-distribution-subdivision-ambiguous" : "aesan-distribution-subdivision-unmapped")];
};
var canonicalCountryRelation = (alert, role, value, code = "") => {
  if (value.status !== "known" || !value.normalized) return [];
  return [mappedCountry(alert, role, {
    rawValue: string(value.published) || value.normalized,
    normalizedValue: value.normalized,
    code,
    sourceField: fieldOf(value, `geography.${role}`),
    reason: `explicit-${role}-country`
  })];
};
var nationalAffectedScope = (alert) => {
  if (alert.source !== "AESAN" && alert.source !== "RAPNA") return [];
  return [mappedCountry(alert, "affected", {
    rawValue: alert.source,
    code: "ES",
    sourceField: "identity.source",
    evidenceType: "national_publication_scope",
    reason: alert.source === "AESAN" ? "aesan-public-alert-addresses-spanish-market" : "rapna-national-consumer-alert-scope"
  })];
};
var safetyGateGeographies = (alert) => {
  const detail3 = record(alert.canonical.sourceRecord.detail);
  const originCode = string(nested(detail3, "traceability", "countryOrigin", "key"));
  const notifyingCode = string(nested(detail3, "country", "key"));
  return [
    ...canonicalCountryRelation(alert, "origin", alert.canonical.geography.originCountry, originCode),
    ...canonicalCountryRelation(alert, "notifying", alert.canonical.geography.notifyingCountry, notifyingCode)
  ];
};
var oecdGeographies = (alert) => {
  const detail3 = record(alert.canonical.sourceRecord.detail);
  const manufacturerCountries = array(detail3["manufacturer.country"]).map(record).flatMap((item) => {
    const code = string(item.id);
    const name = string(item.name);
    return code || name ? [mappedCountry(alert, "origin", {
      rawValue: name || code,
      normalizedValue: name,
      code,
      sourceField: "manufacturer.country",
      reason: "explicit-oecd-manufacturer-country"
    })] : [];
  });
  const originFallback = manufacturerCountries.length ? [] : canonicalCountryRelation(alert, "origin", alert.canonical.geography.originCountry);
  const affected = alert.canonical.geography.affectedTerritories;
  const referenceCode = alert.reference.split("/")[1] ?? "";
  const affectedCode = string(detail3.countryId) || referenceCode;
  const affectedRelations = affected.status === "known" && Array.isArray(affected.normalized) ? affected.normalized.map((name) => mappedCountry(alert, "affected", {
    rawValue: name,
    normalizedValue: name,
    code: affected.normalized?.length === 1 ? affectedCode : "",
    sourceField: fieldOf(affected, "countryName:economy-of-recall"),
    reason: "explicit-oecd-economy-of-recall"
  })) : [];
  return [...manufacturerCountries, ...originFallback, ...affectedRelations];
};
var rasffGeographies = (alert) => {
  const sourceRecord = record(alert.canonical.sourceRecord);
  const index2 = record(sourceRecord.index);
  const detail3 = record(sourceRecord.detail);
  const rows = [];
  const pushCountry = (role, value, sourceField, reason) => {
    const item = record(value);
    const code = string(item.isoCode || item.code).toUpperCase();
    const name = string(item.organizationName || item.description);
    if (!code && !name) return;
    rows.push(mappedCountry(alert, role, {
      rawValue: name || code,
      normalizedValue: name,
      code,
      sourceField,
      evidenceType: "structured_official_country_role",
      reason
    }));
  };
  for (const item of array(index2.originCountries)) pushCountry("origin", item, "index.originCountries", "explicit-rasff-origin-country");
  if (index2.notifyingCountry) pushCountry("notifying", index2.notifyingCountry, "index.notifyingCountry", "explicit-rasff-notifying-country");
  for (const flagRow of array(detail3.organizationFlags).map(record)) {
    const organization = record(flagRow.organization);
    const flags = new Set(array(flagRow.notificationFlags).map(record).map((flag) => string(flag.flagType).toUpperCase()).filter(Boolean));
    if (flags.has("ORIGIN")) pushCountry("origin", organization, "detail.organizationFlags.ORIGIN", "explicit-rasff-origin-flag");
    if (flags.has("NOTIFYING")) pushCountry("notifying", organization, "detail.organizationFlags.NOTIFYING", "explicit-rasff-notifying-flag");
    if (flags.has("DISTRIBUTION")) pushCountry("distribution", organization, "detail.organizationFlags.DISTRIBUTION", "explicit-rasff-distribution-flag");
  }
  return rows;
};
var geographiesFor = (alert) => {
  const common = [
    ...nationalAffectedScope(alert),
    ...alert.source === "AESAN" ? canonicalCountryRelation(alert, "origin", alert.canonical.geography.originCountry) : [],
    ...alert.source === "AESAN" ? [...aesanNotifyingRelations(alert), ...aesanDistributionRelations(alert)] : [],
    ...alert.source === "RAPNA" ? rapnaNotifyingRelations(alert) : []
  ];
  if (alert.source === "SAFETY GATE") return [...common, ...safetyGateGeographies(alert)];
  if (alert.source === "RASFF") return [...common, ...rasffGeographies(alert)];
  if (alert.source === "OECD") return [...common, ...oecdGeographies(alert)];
  return common;
};
var actorsFor = (alert) => alert.canonical.operators.flatMap((operator) => {
  const rawName = string(operator.name.published);
  const normalizedName = string(operator.name.normalized);
  const actorKey = normalizeEntityKey(normalizedName);
  if (operator.name.status !== "known" || !normalizedName || !actorKey) return [];
  return [{
    role: operator.role,
    actorKey,
    rawName: rawName || normalizedName,
    normalizedName,
    sourceField: fieldOf(operator.name, `operators.${operator.role}`),
    evidence: operator.evidence ?? "",
    mappingVersion: dimensionMappingVersionForSource(alert.source)
  }];
});
var productDomain = (alert) => {
  const domain = alert.canonical.product.domain;
  if (domain === "Alimentaria") return "human_food";
  if (domain === "Alimentaci\xF3n animal") return "animal_feed";
  if (domain === "No alimentaria" || domain === "No alimentaci\xF3n") return "non_food";
  return "unknown";
};
var dedupe = (rows, key) => {
  const seen = /* @__PURE__ */ new Set();
  const kept = [];
  let duplicates = 0;
  for (const row of rows) {
    const identity2 = key(row);
    if (seen.has(identity2)) {
      duplicates += 1;
      continue;
    }
    seen.add(identity2);
    kept.push(row);
  }
  return { rows: kept, duplicates };
};
var aggregateStatus = (rows) => {
  if (!rows.length || rows.every((row) => row.status === "unknown")) return "unknown";
  return rows.some((row) => row.status === "mapped") ? "mapped" : "unmapped";
};
function deriveCanonicalDimensions(alert) {
  const category = categoryFor(alert);
  const hazardResult = dedupe(hazardsFor(alert), (row) => row.hazardKey);
  const geographyResult = dedupe(geographiesFor(alert), (row) => `${row.role}|${row.geographyKey}|${row.sourceField}`);
  const actorResult = dedupe(actorsFor(alert), (row) => `${row.role}|${row.actorKey}|${row.sourceField}`);
  const geographies = geographyResult.rows.sort((left, right) => `${left.role}|${left.geographyKey}|${left.sourceField}`.localeCompare(`${right.role}|${right.geographyKey}|${right.sourceField}`, "en"));
  const mapped = geographies.filter((item) => item.status === "mapped");
  const unmapped = geographies.filter((item) => item.status === "unmapped");
  const geographyStatus = !geographies.length ? "unknown" : mapped.length && unmapped.length ? "partial" : mapped.length ? "mapped" : "unmapped";
  const spain = mapped.find((item) => item.countryCode === "ES" && (item.role === "affected" || item.role === "distribution"));
  const affected = geographies.filter((item) => item.role === "affected");
  const completeNonSpainOecdScope = alert.source === "OECD" && affected.length > 0 && affected.every((item) => item.status === "mapped" && item.countryCode && item.countryCode !== "ES" && item.reason === "explicit-oecd-economy-of-recall");
  const affectsSpain = spain ? "true" : completeNonSpainOecdScope ? "false" : "unknown";
  const affectsSpainReason = spain ? `${spain.role}:${spain.sourceField}:${spain.reason}` : completeNonSpainOecdScope ? "complete-oecd-economy-of-recall-excludes-es" : "insufficient-evidence-to-include-or-exclude-es";
  return {
    state: {
      sourceContentHash: alert.contentHash,
      mappingVersion: dimensionMappingVersionForSource(alert.source),
      productDomain: productDomain(alert),
      categoryStatus: category.status,
      hazardStatus: aggregateStatus(hazardResult.rows),
      geographyStatus,
      actorStatus: actorResult.rows.length ? "mapped" : "unknown",
      affectsSpain,
      affectsSpainReason
    },
    categories: [category],
    hazards: hazardResult.rows.sort((a, b) => a.hazardKey.localeCompare(b.hazardKey, "en")),
    geographies,
    actors: actorResult.rows.sort((a, b) => `${a.role}|${a.actorKey}`.localeCompare(`${b.role}|${b.actorKey}`, "en")),
    duplicateCount: hazardResult.duplicates + geographyResult.duplicates + actorResult.duplicates
  };
}

// candidate-probe-v4-src/lib/operational-coverage.ts
var VIGIA_OPERATIONAL_HISTORY_FROM = "2020-01-01";
var officialPublishedAtFields = {
  AESAN: ["publishedAt"],
  "SAFETY GATE": ["publicationDate"],
  RAPNA: ["fechaPublicacion", "fechaPublicadaWeb", "VIGIA:legacy-fecha-alta-as-index-date"],
  RASFF: ["ecValidationDate"],
  OECD: ["date"]
};
var isoCalendarDate = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/u);
  if (!match || Number.isNaN(Date.parse(`${match[1]}T00:00:00.000Z`))) return null;
  return match[1];
};
function classifyOperationalCoverage(alert) {
  const publishedAt = alert.canonical?.dates?.publishedAt;
  const normalized = publishedAt?.normalized;
  const sourceField = publishedAt?.provenance?.[0]?.sourceField;
  const date = isoCalendarDate(normalized);
  if (publishedAt?.status !== "known" || !date || normalized !== alert.publishedAt || !sourceField || !officialPublishedAtFields[alert.source].includes(sourceField)) return "undetermined";
  return date < VIGIA_OPERATIONAL_HISTORY_FROM ? "archive" : "operational";
}
var keepInOperationalDataset = (alert) => classifyOperationalCoverage(alert) !== "archive";
var filterForOperationalDataset = (alerts2) => alerts2.filter(keepInOperationalDataset);
var canonicalOfficialDatePredicateSql = `
  published_at IS NOT NULL
  AND julianday(published_at) IS NOT NULL
  AND json_valid(canonical_json) = 1
  AND json_extract(canonical_json, '$.dates.publishedAt.status') = 'known'
  AND json_extract(canonical_json, '$.dates.publishedAt.normalized') = published_at
  AND (
    (source = 'AESAN' AND json_extract(canonical_json, '$.dates.publishedAt.provenance[0].sourceField') = 'publishedAt')
    OR (source = 'SAFETY GATE' AND json_extract(canonical_json, '$.dates.publishedAt.provenance[0].sourceField') = 'publicationDate')
    OR (source = 'RAPNA' AND json_extract(canonical_json, '$.dates.publishedAt.provenance[0].sourceField') IN (
      'fechaPublicacion', 'fechaPublicadaWeb', 'VIGIA:legacy-fecha-alta-as-index-date'
    ))
    OR (source = 'RASFF' AND json_extract(canonical_json, '$.dates.publishedAt.provenance[0].sourceField') = 'ecValidationDate')
    OR (source = 'OECD' AND json_extract(canonical_json, '$.dates.publishedAt.provenance[0].sourceField') = 'date')
  )`;
var operationalClassExpressionSql = `CASE
  WHEN ${canonicalOfficialDatePredicateSql}
    THEN CASE WHEN published_at < '${VIGIA_OPERATIONAL_HISTORY_FROM}' THEN 'archive' ELSE 'operational' END
  ELSE 'undetermined'
END`;

// candidate-probe-v4-src/lib/rapna-published.ts
var exactText = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
var exactPositiveInteger = (value) => {
  if (value === null || value === void 0 || value === "") return null;
  const number2 = Number(value);
  return Number.isSafeInteger(number2) && number2 > 0 ? number2 : null;
};
var sameMaterialText = (left, right) => left.localeCompare(right, "es", { sensitivity: "base" }) === 0;
var currentValues = (raw, expectedReference) => {
  const schemas = [RAPNA_CURRENT_FIELDS, RAPNA_CURRENT_FIELDS.slice(0, -1)];
  for (const fields of schemas) {
    if (raw.length < fields.length) continue;
    const tail = raw.slice(raw.length - fields.length);
    if (exactText(tail[0]) !== expectedReference) continue;
    return Object.fromEntries(fields.map((field, index2) => [field, tail[index2]]));
  }
  return null;
};
var expansionFrom2 = (values, alertId, index2) => {
  const prefix = `ampliacion${index2}.`;
  const id = exactPositiveInteger(values[`${prefix}id`]);
  const number2 = exactText(values[`${prefix}numero`]);
  const createdAt = exactText(values[`${prefix}fechaAlta`]);
  const expandedAt = exactText(values[`${prefix}fechaAmpliacion`]);
  const reason = exactText(values[`${prefix}motivo`]);
  const notifyingBody = exactText(values[`${prefix}organo.nombre`]);
  const imageFile = exactText(values[`${prefix}fotografia`]);
  if (!id && !number2 && !createdAt && !expandedAt && !reason && !notifyingBody && !imageFile) return null;
  const fields = [
    createdAt ? { key: "registration", value: createdAt, sourceField: `${prefix}fechaAlta`, order: 0 } : null,
    expandedAt ? { key: "expansion", value: expandedAt, sourceField: `${prefix}fechaAmpliacion`, order: 1 } : null,
    reason ? { key: "reason", value: reason, sourceField: `${prefix}motivo`, order: 2 } : null,
    notifyingBody ? { key: "notifyingBody", value: notifyingBody, sourceField: `${prefix}organo.nombre`, order: 3 } : null
  ].filter((field) => Boolean(field));
  return {
    number: number2,
    sourceField: `ampliacion${index2}`,
    fields,
    image: imageFile && id ? {
      kind: "image",
      url: rapnaResourceUrl("current", alertId, imageFile, "image", id),
      label: `Imagen oficial de la ampliaci\xF3n ${number2 ?? index2}`,
      sourceField: `${prefix}fotografia`,
      order: index2
    } : null,
    order: index2
  };
};
var currentRecord = (canonical, raw) => {
  const canonicalReference = exactText(canonical.identity.officialReference);
  if (!canonicalReference) return null;
  const values = currentValues(raw, canonicalReference);
  const alertId = exactPositiveInteger(raw[0]);
  const officialReference = exactText(values?.identificador) ?? canonicalReference;
  const officialTitle = exactText(values?.nombrePublicacionWeb);
  if (!values || !alertId || !officialReference || !officialTitle) return null;
  const category = exactText(values["categoria.nombre"]);
  const authorityName = exactText(values["organoActuante.nombre"]);
  const authorityDescription = exactText(values["organoActuante.descripcion"]);
  const imageFile = exactText(raw[2]);
  const publishedData = [
    category ? { key: "category", value: category, sourceField: "categoria.nombre", order: 0 } : null,
    authorityName ? { key: "notifyingBodyName", value: authorityName, sourceField: "organoActuante.nombre", order: 1 } : null,
    authorityDescription && (!authorityName || !sameMaterialText(authorityName, authorityDescription)) ? { key: "notifyingBodyDescription", value: authorityDescription, sourceField: "organoActuante.descripcion", order: 2 } : null
  ].filter((field) => Boolean(field));
  const officialDates = [
    exactText(values.fechaPublicacion) ? { key: "notification", value: exactText(values.fechaPublicacion), sourceField: "fechaPublicacion", order: 0 } : null,
    exactText(values.fechaPublicadaWeb) ? { key: "webPublication", value: exactText(values.fechaPublicadaWeb), sourceField: "fechaPublicadaWeb", order: 1 } : null,
    exactText(values.fechaModificacion) ? { key: "modification", value: exactText(values.fechaModificacion), sourceField: "fechaModificacion", order: 2 } : null
  ].filter((date) => Boolean(date));
  return {
    archive: "current",
    officialReference,
    officialTitle,
    publishedData,
    risk: exactText(values.peligroPublicacionWeb),
    information: exactText(values.textoPublicacionWeb),
    observation: exactText(values.observacionPublicacionWeb),
    measures: exactText(values.medidasPublicacionWeb),
    officialDates,
    primaryImage: imageFile ? {
      kind: "image",
      url: rapnaResourceUrl("current", alertId, imageFile, "image"),
      label: "Imagen oficial RAPNA",
      sourceField: "imagenFichaWeb",
      order: 0
    } : null,
    expansions: [1, 2, 3].flatMap((index2) => expansionFrom2(values, alertId, index2) ?? []),
    documents: []
  };
};
var legacyRecord = (canonical, raw) => {
  const alertId = exactPositiveInteger(raw.id);
  const officialReference = exactText(raw.identificador) ?? exactText(canonical.identity.officialReference);
  const officialTitle = exactText(raw.nombre);
  if (!alertId || !officialReference || !officialTitle) return null;
  const imageFile = exactText(raw.imagen);
  const documentFile = exactText(raw.documento);
  const publishedData = [
    exactText(raw.numero) ? { key: "number", value: exactText(raw.numero), sourceField: "numero", order: 0 } : null,
    exactPositiveInteger(raw.ano) ? { key: "year", value: String(exactPositiveInteger(raw.ano)), sourceField: "ano", order: 1 } : null,
    exactText(raw.categoria) ? { key: "category", value: exactText(raw.categoria), sourceField: "categoria", order: 2 } : null,
    exactText(raw.organoActuante) ? { key: "notifyingBodyName", value: exactText(raw.organoActuante), sourceField: "organoActuante", order: 3 } : null,
    typeof raw.publicada === "boolean" ? { key: "publicationStatus", value: raw.publicada ? "published" : "not_published", sourceField: "publicada", order: 4 } : null
  ].filter((field) => Boolean(field));
  return {
    archive: "legacy",
    officialReference,
    officialTitle,
    publishedData,
    risk: null,
    information: null,
    observation: null,
    measures: null,
    officialDates: exactText(raw.fechaAlta) ? [{ key: "registration", value: exactText(raw.fechaAlta), sourceField: "fechaAlta", order: 0 }] : [],
    primaryImage: imageFile ? {
      kind: "image",
      url: rapnaResourceUrl("legacy", alertId, imageFile, "image"),
      label: "Imagen oficial RAPNA",
      sourceField: "imagen",
      order: 0
    } : null,
    expansions: [],
    documents: documentFile ? [{
      kind: "document",
      url: rapnaResourceUrl("legacy", alertId, documentFile, "document"),
      label: `Documento oficial ${officialReference}`,
      sourceField: "documento",
      order: 0
    }] : []
  };
};
function rapnaPublishedRecord(canonical) {
  if (!canonical || canonical.identity.source !== "RAPNA") return null;
  const archive = canonical.sourceRecord.archive;
  const raw = canonical.sourceRecord.record;
  if (archive === "current" && Array.isArray(raw)) return currentRecord(canonical, raw);
  if (archive === "legacy" && raw && typeof raw === "object" && !Array.isArray(raw)) {
    return legacyRecord(canonical, raw);
  }
  return null;
}

// candidate-probe-v4-src/lib/persistence/source-sync-lease.ts
var DEFAULT_SYNC_LEASE_TTL_MS = 15 * 6e4;
var SyncLeaseLostError = class extends Error {
  constructor() {
    super("La ejecuci\xF3n perdi\xF3 el lease activo antes de poder persistir");
    this.name = "SyncLeaseLostError";
  }
};
var leaseStore = (store) => {
  if (!store.acquireSyncLease || !store.renewSyncLease || !store.releaseSyncLease) {
    throw new Error("AlertStore no dispone del lease at\xF3mico de sincronizaci\xF3n");
  }
  return {
    acquire: store.acquireSyncLease.bind(store),
    renew: store.renewSyncLease.bind(store),
    release: store.releaseSyncLease.bind(store)
  };
};
async function acquireSourceLease(store, source, mode, options = {}) {
  const persistence = leaseStore(store);
  const clock = options.now ?? (() => /* @__PURE__ */ new Date());
  const ttl = Math.max(6e4, Math.trunc(options.leaseTtlMs ?? DEFAULT_SYNC_LEASE_TTL_MS));
  const ownerId = options.ownerId ?? crypto.randomUUID();
  const acquiredAt = clock().toISOString();
  const expiresAt = new Date(new Date(acquiredAt).getTime() + ttl).toISOString();
  const attempt = await persistence.acquire(source, mode, ownerId, acquiredAt, expiresAt);
  if (!attempt.acquired) return { acquired: false, ownerId, lease: attempt.lease };
  let lease = attempt.lease;
  let released = false;
  return {
    acquired: true,
    ownerId,
    get lease() {
      return lease;
    },
    async renew() {
      if (released) throw new SyncLeaseLostError();
      const heartbeatAt = clock().toISOString();
      const renewedExpiry = new Date(new Date(heartbeatAt).getTime() + ttl).toISOString();
      const renewed = await persistence.renew(source, ownerId, heartbeatAt, renewedExpiry);
      if (!renewed) throw new SyncLeaseLostError();
      lease = renewed;
      return lease;
    },
    async release() {
      if (released) return false;
      released = true;
      return persistence.release(source, ownerId);
    }
  };
}

// candidate-probe-v4-src/lib/safety-gate-snapshot.ts
var stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stableValue(child)]));
  }
  return value;
};
var stableJson = (value) => JSON.stringify(stableValue(value));
async function sha256(value) {
  const bytes2 = new TextEncoder().encode(stableJson(value));
  const digest2 = await crypto.subtle.digest("SHA-256", bytes2);
  return [...new Uint8Array(digest2)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// candidate-probe-v4-src/lib/rapna-snapshot.ts
var CURRENT_SNAPSHOT_FORMAT = 2;
var DEFAULT_RAPNA_CURRENT_SNAPSHOT_BATCH_SIZE = 50;
var currentSnapshotStore = (store) => {
  if (!store.beginRapnaCurrentSnapshot || !store.readRapnaCurrentSnapshotManifest || !store.findRapnaCurrentSnapshotManifest || !store.readRapnaCurrentSnapshotChunks || !store.readRapnaCurrentSnapshotTail || !store.readRapnaCurrentAlertPage || !store.readRapnaCurrentVersions || !store.appendRapnaCurrentSnapshotChunk || !store.finalizeRapnaCurrentSnapshot || !store.updateRapnaCurrentSnapshotStatus || !store.readRapnaCurrentControlState || !store.restoreRapnaCurrentSnapshotChunk || !store.removeRapnaCurrentAlertsAbsentFromSnapshot || !store.finalizeRapnaCurrentSnapshotRestore) {
    throw new Error("AlertStore no dispone del snapshot RAPNA CURRENT V2 paginado");
  }
  return {
    begin: store.beginRapnaCurrentSnapshot.bind(store),
    readManifest: store.readRapnaCurrentSnapshotManifest.bind(store),
    findManifest: store.findRapnaCurrentSnapshotManifest.bind(store),
    readChunks: store.readRapnaCurrentSnapshotChunks.bind(store),
    readTail: store.readRapnaCurrentSnapshotTail.bind(store),
    readAlertPage: store.readRapnaCurrentAlertPage.bind(store),
    readVersions: store.readRapnaCurrentVersions.bind(store),
    appendChunk: store.appendRapnaCurrentSnapshotChunk.bind(store),
    finalize: store.finalizeRapnaCurrentSnapshot.bind(store),
    updateStatus: store.updateRapnaCurrentSnapshotStatus.bind(store),
    readControl: store.readRapnaCurrentControlState.bind(store),
    restoreChunk: store.restoreRapnaCurrentSnapshotChunk.bind(store),
    removeAbsent: store.removeRapnaCurrentAlertsAbsentFromSnapshot.bind(store),
    finalizeRestore: store.finalizeRapnaCurrentSnapshotRestore.bind(store)
  };
};
var rowDigest = (alertChunk) => sha256({
  alert: alertChunk.alert,
  versions: [...alertChunk.versions].sort((left, right) => left.id - right.id)
});
var sourceChecksumFrom = (rowDigests, sourceChecks2, currentReplay) => sha256({ formatVersion: CURRENT_SNAPSHOT_FORMAT, rowDigests, sourceChecks: sourceChecks2, currentReplay });
async function rapnaCurrentLiveSourceDataChecksum(store) {
  const persistence = currentSnapshotStore(store);
  const baseline = await persistence.readControl();
  let cursor = null;
  const rowDigests = [];
  let sourceAlertCount = 0;
  let versionCount = 0;
  while (true) {
    const alerts2 = await persistence.readAlertPage(cursor, DEFAULT_RAPNA_CURRENT_SNAPSHOT_BATCH_SIZE);
    if (alerts2.length > DEFAULT_RAPNA_CURRENT_SNAPSHOT_BATCH_SIZE) throw new Error("Lectura RAPNA CURRENT excedi\xF3 el l\xEDmite de p\xE1gina");
    if (!alerts2.length) break;
    const versions = await persistence.readVersions(alerts2.map((alert) => alert.id));
    const versionsByAlert = /* @__PURE__ */ new Map();
    for (const version2 of versions) {
      const values = versionsByAlert.get(version2.alertId) ?? [];
      values.push(version2);
      versionsByAlert.set(version2.alertId, values);
    }
    for (const alert of alerts2) {
      if (cursor !== null && alert.id.localeCompare(cursor) <= 0) throw new Error("Paginaci\xF3n RAPNA CURRENT inestable");
      const row = { alert, versions: (versionsByAlert.get(alert.id) ?? []).sort((left, right) => left.id - right.id) };
      rowDigests.push(await rowDigest(row));
      sourceAlertCount += 1;
      versionCount += row.versions.length;
      cursor = alert.id;
    }
    if (alerts2.length < DEFAULT_RAPNA_CURRENT_SNAPSHOT_BATCH_SIZE) break;
  }
  return {
    checksum: await sourceChecksumFrom(rowDigests, baseline.sourceChecks, baseline.currentReplay),
    sourceAlertCount,
    versionCount,
    control: baseline
  };
}

// candidate-probe-v4-src/lib/oecd-published.ts
var record2 = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
var stableValue2 = (value) => {
  if (Array.isArray(value)) return value.map(stableValue2).sort((left, right) => {
    const a = JSON.stringify(left);
    const b = JSON.stringify(right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stableValue2(child)]));
  return value;
};
var detail = (canonical) => record2(canonical.sourceRecord.detail);
var MATERIAL_DETAIL_FIELDS = [
  "uri",
  "id",
  "language",
  "languageId",
  "countryId",
  "countryName",
  "date",
  "extUrl",
  "product.name",
  "product.desc",
  "product.type",
  "product.modelAndVolume",
  "product.code",
  "gtin",
  "gtin.desc",
  "gtin.product.type",
  "hts",
  "hts.desc",
  "hts.product.type",
  "manufacturer.country",
  "manufacturer.name",
  "manufacturer.url",
  "distributor.name",
  "distributor.website",
  "hazard",
  "riskLevel",
  "injuries",
  "action",
  "units",
  "images",
  "tags"
];
var oecdOfficialSourceProjection = (canonical) => {
  if (canonical.identity.source !== "OECD") return null;
  const raw = detail(canonical);
  if (!raw) return null;
  return stableValue2(Object.fromEntries(MATERIAL_DETAIL_FIELDS.flatMap((key) => key in raw ? [[key, raw[key]]] : [])));
};
var oecdOfficialSourceFingerprint = (canonical) => {
  const projection = oecdOfficialSourceProjection(canonical);
  return projection === null ? null : JSON.stringify(projection);
};
var sha2562 = async (value) => {
  const digest2 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest2)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
async function oecdContentHash(canonical) {
  const canonicalHash = await canonicalContentHash(canonical);
  return sha2562(JSON.stringify({ canonicalHash, official: oecdOfficialSourceProjection(canonical) }));
}

// candidate-probe-v4-src/lib/safety-gate-published.ts
var record3 = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
var exactText2 = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
var stableValue3 = (value) => {
  if (Array.isArray(value)) return value.map(stableValue3).sort((left, right) => {
    const leftValue = JSON.stringify(left);
    const rightValue = JSON.stringify(right);
    return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
  });
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, child]) => [key, stableValue3(child)]));
  return value;
};
var sourceDetail = (canonical) => record3(canonical.sourceRecord.detail);
var safetyGateOfficialSourceProjection = (canonical) => {
  if (canonical.identity.source !== "SAFETY GATE") return null;
  const detail3 = sourceDetail(canonical);
  if (!detail3) return null;
  if (record3(detail3.product) || record3(detail3.risk) || record3(detail3.measureTaken)) {
    const semantic = { ...detail3 };
    const modificationDate = semantic.modificationDate;
    delete semantic.creationDate;
    delete semantic.publicationDate;
    delete semantic.modificationDate;
    delete semantic.versions;
    delete semantic.singlePublication;
    delete semantic.webReport;
    const materialModificationDate = exactText2(detail3.corrigendum) ? exactText2(modificationDate) : null;
    return stableValue3({ ...semantic, ...materialModificationDate ? { modificationDate: materialModificationDate } : {} });
  }
  return stableValue3(detail3);
};
var safetyGateOfficialSourceFingerprint = (canonical) => {
  const projection = safetyGateOfficialSourceProjection(canonical);
  return projection === null ? null : JSON.stringify(projection);
};
var safetyGateOfficiallyEquivalent = (before, after) => {
  if (before.identity.source !== "SAFETY GATE" || after.identity.source !== "SAFETY GATE") return false;
  const left = safetyGateOfficialSourceFingerprint(before);
  const right = safetyGateOfficialSourceFingerprint(after);
  return Boolean(left && right && left === right && before.identity.internalId === after.identity.internalId && before.identity.officialReference === after.identity.officialReference && before.identity.sourceRecordId === after.identity.sourceRecordId && before.identity.officialUrl === after.identity.officialUrl);
};
var sha2563 = async (value) => {
  const digest2 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest2)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
async function safetyGateContentHash(canonical) {
  const canonicalHash = await canonicalContentHash(canonical);
  return sha2563(JSON.stringify({ canonicalHash, official: safetyGateOfficialSourceProjection(canonical) }));
}

// candidate-probe-v4-src/lib/persistence/d1-dimensions.ts
function dimensionReplacementStatements(db, alert, dimensions = deriveCanonicalDimensions(alert)) {
  const statements = [
    db.prepare("DELETE FROM alert_categories WHERE alert_id = ?").bind(alert.id),
    db.prepare("DELETE FROM alert_hazards WHERE alert_id = ?").bind(alert.id),
    db.prepare("DELETE FROM alert_geographies WHERE alert_id = ?").bind(alert.id),
    db.prepare("DELETE FROM alert_actors WHERE alert_id = ?").bind(alert.id),
    ...dimensions.categories.map((item) => db.prepare(`INSERT INTO alert_categories
      (alert_id, category_key, raw_value, source_normalized, canonical_code, status,
       source_field, evidence_type, reason, mapping_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      alert.id,
      item.categoryKey,
      item.rawValue,
      item.sourceNormalized,
      item.canonicalCode,
      item.status,
      item.sourceField,
      item.evidenceType,
      item.reason,
      item.mappingVersion
    )),
    ...dimensions.hazards.map((item) => db.prepare(`INSERT INTO alert_hazards
      (alert_id, hazard_key, raw_value, source_normalized, canonical_code, status,
       source_field, evidence_type, reason, mapping_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      alert.id,
      item.hazardKey,
      item.rawValue,
      item.sourceNormalized,
      item.canonicalCode,
      item.status,
      item.sourceField,
      item.evidenceType,
      item.reason,
      item.mappingVersion
    )),
    ...dimensions.geographies.map((item) => db.prepare(`INSERT INTO alert_geographies
      (alert_id, role, geography_key, geography_code, code_scheme, country_code, subdivision_code,
       admin_level, raw_value, source, source_field, evidence_type, reason, status, mapping_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      alert.id,
      item.role,
      item.geographyKey,
      item.geographyCode,
      item.codeScheme,
      item.countryCode,
      item.subdivisionCode,
      item.adminLevel,
      item.rawValue,
      item.source,
      item.sourceField,
      item.evidenceType,
      item.reason,
      item.status,
      item.mappingVersion
    )),
    ...dimensions.actors.map((item) => db.prepare(`INSERT INTO alert_actors
      (alert_id, role, actor_key, raw_name, normalized_name, source_field, evidence, mapping_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      alert.id,
      item.role,
      item.actorKey,
      item.rawName,
      item.normalizedName,
      item.sourceField,
      item.evidence,
      item.mappingVersion
    )),
    db.prepare(`INSERT INTO alert_dimension_state
      (alert_id, source_content_hash, mapping_version, product_domain, category_status, hazard_status,
       geography_status, actor_status, affects_spain, affects_spain_reason, derived_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(alert_id) DO UPDATE SET
        source_content_hash=excluded.source_content_hash, mapping_version=excluded.mapping_version,
        product_domain=excluded.product_domain, category_status=excluded.category_status,
        hazard_status=excluded.hazard_status, geography_status=excluded.geography_status,
        actor_status=excluded.actor_status, affects_spain=excluded.affects_spain,
        affects_spain_reason=excluded.affects_spain_reason, derived_at=CURRENT_TIMESTAMP`).bind(
      alert.id,
      dimensions.state.sourceContentHash,
      dimensions.state.mappingVersion,
      dimensions.state.productDomain,
      dimensions.state.categoryStatus,
      dimensions.state.hazardStatus,
      dimensions.state.geographyStatus,
      dimensions.state.actorStatus,
      dimensions.state.affectsSpain,
      dimensions.state.affectsSpainReason
    )
  ];
  return statements;
}
async function replaceAlertDimensions(alert, db = getD1(), dimensions = deriveCanonicalDimensions(alert)) {
  await db.batch(dimensionReplacementStatements(db, alert, dimensions));
  return dimensions;
}

// candidate-probe-v4-src/lib/persistence/d1-alert-store.ts
var safetyGateOfficialNullPublicationSql = (canonical, source, publishedAt) => `
  ${source} = 'SAFETY GATE' AND ${publishedAt} IS NULL
  AND json_valid(${canonical}) = 1
  AND json_type(${canonical}, '$.sourceRecord.detail.publicationDate') = 'null'
  AND json_extract(${canonical}, '$.dates.publishedAt.status') = 'unknown'
  AND json_type(${canonical}, '$.dates.publishedAt.normalized') = 'null'
`;
var SourceIdentityConflictError = class extends Error {
  constructor(message) {
    super(message);
    this.code = "SOURCE_IDENTITY_CONFLICT";
    this.name = "SourceIdentityConflictError";
  }
};
var UnknownSourcePersistenceError = class extends SyncLeaseLostError {
  constructor(error) {
    super();
    this.name = "UnknownSourcePersistenceError";
    this.message = "SOURCE_PERSISTENCE_OUTCOME_UNKNOWN: " + (error instanceof Error ? error.message : "D1 batch result unavailable");
  }
};
var sourceRecordIdFor = (alert) => alert.canonical.identity.sourceRecordId.trim();
var previousReferencesFor = (alert) => {
  const values = alert.canonical.sourceRecord?.previousReferences;
  return Array.isArray(values) ? [...new Set(values.filter((value) => typeof value === "string").map((value) => value.trim()).filter((value) => value && value !== alert.reference))].sort() : [];
};
var withInternalId = (alert, id) => ({
  ...alert,
  id,
  canonical: { ...alert.canonical, identity: { ...alert.canonical.identity, internalId: id } }
});
var isOfficialAesanUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.aesan.gob.es" && url.pathname.startsWith("/alertas/");
  } catch {
    return false;
  }
};
var stableJsonValue = (value) => {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, child]) => [key, stableJsonValue(child)]));
  }
  return value;
};
var serializeStable = (value) => JSON.stringify(stableJsonValue(value));
var serializeCanonical = (canonical) => serializeStable(canonical);
var canonicalMetadataComparable = (canonical) => {
  if (canonical.identity.source !== "OECD") return { ...canonical, dates: { ...canonical.dates, detectedAt: "" } };
  const sourceRecord = { ...canonical.sourceRecord };
  for (const key of ["mechanisms", "rss", "search", "export", "portalCreatedAt"]) delete sourceRecord[key];
  return { ...canonical, dates: { ...canonical.dates, detectedAt: "" }, sourceRecord };
};
var canonicalMetadataChanged = (canonicalJson, incoming) => {
  if (!canonicalJson || canonicalJson === "{}") return false;
  try {
    const stored = JSON.parse(canonicalJson);
    return serializeCanonical(canonicalMetadataComparable(stored)) !== serializeCanonical(canonicalMetadataComparable(incoming));
  } catch {
    return true;
  }
};
var canonicalForMetadataRefresh = (canonicalJson, incoming, storedDetectedAt) => {
  let detectedAt = storedDetectedAt;
  try {
    const stored = JSON.parse(canonicalJson);
    if (typeof stored.dates?.detectedAt === "string" && stored.dates.detectedAt) detectedAt = stored.dates.detectedAt;
  } catch {
  }
  return { ...incoming, dates: { ...incoming.dates, detectedAt } };
};
var aesanPublishedSourceHash = (canonical) => {
  const record7 = canonical?.sourceRecord;
  return canonical?.identity.source === "AESAN" && record7?.sourceRecordSchemaVersion === 2 && typeof record7.sourceRecordHash === "string" && /^[0-9a-f]{64}$/u.test(record7.sourceRecordHash) ? record7.sourceRecordHash : null;
};
var isInitialAesanPublishedBaseline = (canonicalJson, incoming) => {
  const incomingHash = aesanPublishedSourceHash(incoming);
  if (!incomingHash || !canonicalJson || canonicalJson === "{}") return false;
  try {
    const stored = JSON.parse(canonicalJson);
    return stored.identity?.source === "AESAN" && !aesanPublishedSourceHash(stored);
  } catch {
    return false;
  }
};
var rapnaDerivedFields = (canonical) => ({
  model: canonical.product.model,
  commercialReference: canonical.product.commercialReference,
  lots: canonical.product.lots,
  identifiers: canonical.product.identifiers
});
var analyzeRapnaParserRepair = (canonicalJson, incoming) => {
  const empty = {
    baselineRepair: false,
    legacyRawBaselineRepair: false,
    ghostExpansionRepair: false,
    pluralLabelRepair: false,
    observationRefresh: false,
    comparablePublishedRecord: false
  };
  if (incoming.identity.source !== "RAPNA" || !canonicalJson || canonicalJson === "{}") return empty;
  try {
    const stored = JSON.parse(canonicalJson);
    const before = rapnaPublishedRecord(stored);
    const after = rapnaPublishedRecord(incoming);
    if (!before || !after || before.archive !== after.archive) return empty;
    if (before.archive === "legacy" && after.archive === "legacy") {
      const sameIdentity = stored.identity.source === "RAPNA" && stored.identity.internalId === incoming.identity.internalId && stored.identity.sourceRecordId === incoming.identity.sourceRecordId && stored.identity.officialReference === incoming.identity.officialReference && stored.identity.officialUrl === incoming.identity.officialUrl;
      const sameRaw = serializeStable(stored.sourceRecord.record) === serializeStable(incoming.sourceRecord.record);
      const sameDuplicateRaw = serializeStable(stored.sourceRecord.duplicateSourceRecords ?? []) === serializeStable(incoming.sourceRecord.duplicateSourceRecords ?? []);
      const comparablePublishedRecord2 = serializeStable(before) === serializeStable(after);
      const legacyRawBaselineRepair = sameIdentity && sameRaw && sameDuplicateRaw && comparablePublishedRecord2;
      return {
        ...empty,
        baselineRepair: legacyRawBaselineRepair,
        legacyRawBaselineRepair,
        comparablePublishedRecord: comparablePublishedRecord2
      };
    }
    if (before.archive !== "current" || after.archive !== "current") return empty;
    const withoutObservation = (record7) => ({ ...record7, observation: null });
    const comparablePublishedRecord = serializeStable(withoutObservation(before)) === serializeStable(withoutObservation(after));
    const observationRefresh = comparablePublishedRecord && before.observation !== after.observation;
    if (!comparablePublishedRecord) return { ...empty, observationRefresh, comparablePublishedRecord };
    const ghostExpansionRepair = stored.lifecycle.officialUpdate.normalized === true && incoming.lifecycle.officialUpdate.normalized === false && before.expansions.length === 0 && after.expansions.length === 0;
    const pluralLabelRepair = /(?:^|,|;)\s*(?:modelos|lotes|refs\.?|referencias)\b/iu.test(after.officialTitle) && serializeStable(rapnaDerivedFields(stored)) !== serializeStable(rapnaDerivedFields(incoming));
    if (!ghostExpansionRepair && !pluralLabelRepair) {
      return { ...empty, observationRefresh, comparablePublishedRecord };
    }
    const repairedStored = {
      ...stored,
      dates: { ...stored.dates, detectedAt: incoming.dates.detectedAt },
      lifecycle: incoming.lifecycle,
      product: { ...stored.product, ...rapnaDerivedFields(incoming) },
      sourceRecord: incoming.sourceRecord
    };
    return {
      ...empty,
      baselineRepair: serializeCanonical(repairedStored) === serializeCanonical(incoming),
      ghostExpansionRepair,
      pluralLabelRepair,
      observationRefresh,
      comparablePublishedRecord
    };
  } catch {
    return empty;
  }
};
var isInitialRapnaParserRepairBaseline = (canonicalJson, incoming) => {
  const analysis = analyzeRapnaParserRepair(canonicalJson, incoming);
  return analysis.baselineRepair && !analysis.legacyRawBaselineRepair;
};
var isInitialRapnaLegacyParserRepairBaseline = (canonicalJson, incoming) => analyzeRapnaParserRepair(canonicalJson, incoming).legacyRawBaselineRepair;
var isInitialSafetyGateParserBaseline = (canonicalJson, incoming) => {
  if (incoming.identity.source !== "SAFETY GATE" || !canonicalJson || canonicalJson === "{}") return false;
  try {
    const stored = JSON.parse(canonicalJson);
    return safetyGateOfficiallyEquivalent(stored, incoming);
  } catch {
    return false;
  }
};
var isInitialOecdParserBaseline = (canonicalJson, incoming) => {
  if (incoming.identity.source !== "OECD" || !canonicalJson || canonicalJson === "{}") return false;
  try {
    const stored = JSON.parse(canonicalJson);
    const before = oecdOfficialSourceFingerprint(stored);
    const after = oecdOfficialSourceFingerprint(incoming);
    return Boolean(before && after && before === after && stored.identity.internalId === incoming.identity.internalId && stored.identity.sourceRecordId === incoming.identity.sourceRecordId && stored.identity.officialReference === incoming.identity.officialReference && stored.identity.officialUrl === incoming.identity.officialUrl);
  } catch {
    return false;
  }
};
async function runBatches(statements, size = 50, db = getD1()) {
  for (let index2 = 0; index2 < statements.length; index2 += size) {
    await db.batch(statements.slice(index2, index2 + size));
  }
}
var ALERT_REFERENCE_READ_CHUNK_SIZE = 25;
var chunkAlertReferencesForRead = (references) => {
  const normalized = [...new Set(references.map((value) => value.trim()).filter(Boolean))];
  const chunks = [];
  for (let index2 = 0; index2 < normalized.length; index2 += ALERT_REFERENCE_READ_CHUNK_SIZE) {
    chunks.push(normalized.slice(index2, index2 + ALERT_REFERENCE_READ_CHUNK_SIZE));
  }
  return chunks;
};
var normalizeDbAlert = (row) => {
  const { canonicalJson, ...legacyRow } = row;
  const legacy = {
    ...legacyRow,
    lots: (() => {
      try {
        return JSON.parse(row.lots || "[]");
      } catch {
        return [];
      }
    })(),
    isUpdate: Boolean(row.isUpdate)
  };
  try {
    const canonical = JSON.parse(canonicalJson || "{}");
    return ensureCanonicalAlert({ ...legacy, canonical });
  } catch {
    return { ...legacy, canonical: canonicalFromLegacy(legacy) };
  }
};
var alertsSelect = `
  SELECT id, reference, source, type, priority, title, product, brand,
    product_class AS productClass, product_key AS productKey, brand_key AS brandKey,
    provider, provider_key AS providerKey, provider_role AS providerRole, provider_evidence AS providerEvidence,
    hazard, origin, scope, action,
    lots, image_url AS imageUrl, url, published_at AS publishedAt, detected_at AS detectedAt,
    updated_at AS updatedAt, content_hash AS contentHash, version_count AS versionCount, is_update AS isUpdate,
    canonical_json AS canonicalJson
  FROM alerts`;
var alertViewsSelect = `
  SELECT id, reference, source, type, priority, title, product, brand,
    product_class AS productClass, product_key AS productKey, brand_key AS brandKey,
    provider, provider_key AS providerKey, provider_role AS providerRole, provider_evidence AS providerEvidence,
    hazard, origin, scope, action,
    lots, image_url AS imageUrl, url, published_at AS publishedAt, detected_at AS detectedAt,
    updated_at AS updatedAt, content_hash AS contentHash, version_count AS versionCount, is_update AS isUpdate
  FROM alerts`;
var normalizeDbAlertView = (row) => ({
  ...row,
  lots: (() => {
    try {
      return JSON.parse(row.lots || "[]");
    } catch {
      return [];
    }
  })(),
  isUpdate: Boolean(row.isUpdate)
});
var syncStateSelect = `
  SELECT source, mode, status, cursor, plan_version AS planVersion, cursor_key AS cursorKey,
    total_units AS totalUnits, pages_scanned AS pagesScanned,
    records_observed AS recordsObserved, records_persisted AS recordsPersisted,
    new_count AS newCount, updated_count AS updatedCount, detail_failures AS detailFailures,
    page_errors AS pageErrors, oldest_published_at AS oldestPublishedAt,
    newest_published_at AS newestPublishedAt, coverage, started_at AS startedAt,
    last_success_at AS lastSuccessAt, completed_at AS completedAt, last_error AS lastError,
    lease_owner_id AS leaseOwnerId, lease_mode AS leaseMode, lease_expires_at AS leaseExpiresAt,
    last_skipped_at AS lastSkippedAt, last_skip_reason AS lastSkipReason,
    last_skipped_owner_id AS lastSkippedOwnerId, updated_at AS updatedAt
  FROM source_sync_state`;
var leaseSelect = `
  SELECT source, owner_id AS ownerId, mode, acquired_at AS acquiredAt,
    heartbeat_at AS heartbeatAt, expires_at AS expiresAt
  FROM source_sync_locks`;
var revisionCertificationSelect = `
  SELECT source, mode, cycle_id AS cycleId, completed_at AS completedAt,
    total_units AS totalUnits, records_observed AS recordsObserved, coverage,
    audit_status AS auditStatus, audit_checked_at AS auditCheckedAt,
    evidence_json AS evidenceJson, updated_at AS updatedAt
  FROM source_revision_certifications`;
var bindAlertInsert = (db, alert) => db.prepare(`
  INSERT INTO alerts (
    id, reference, source, type, priority, title, product, brand,
    product_class, product_key, brand_key, provider, provider_key, provider_role, provider_evidence,
    hazard, origin, scope, action, lots, image_url, url, published_at, detected_at, updated_at,
    content_hash, version_count, is_update, canonical_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  alert.id,
  alert.reference,
  alert.source,
  alert.type,
  alert.priority,
  alert.title,
  alert.product,
  alert.brand,
  alert.productClass,
  alert.productKey,
  alert.brandKey,
  alert.provider,
  alert.providerKey,
  alert.providerRole,
  alert.providerEvidence,
  alert.hazard,
  alert.origin,
  alert.scope,
  alert.action,
  JSON.stringify(alert.lots),
  alert.imageUrl,
  alert.url,
  alert.publishedAt,
  alert.detectedAt,
  alert.updatedAt,
  alert.contentHash,
  alert.versionCount,
  alert.isUpdate ? 1 : 0,
  serializeCanonical(alert.canonical)
);
var bindAlertRestoreUpdate = (db, alert) => db.prepare(`
  UPDATE alerts SET
    reference=?, source=?, type=?, priority=?, title=?, product=?, brand=?,
    product_class=?, product_key=?, brand_key=?, provider=?, provider_key=?, provider_role=?, provider_evidence=?,
    hazard=?, origin=?, scope=?, action=?, lots=?, image_url=?, url=?, published_at=?, detected_at=?, updated_at=?,
    content_hash=?, version_count=?, is_update=?, canonical_json=?
  WHERE id=? AND source=?
`).bind(
  alert.reference,
  alert.source,
  alert.type,
  alert.priority,
  alert.title,
  alert.product,
  alert.brand,
  alert.productClass,
  alert.productKey,
  alert.brandKey,
  alert.provider,
  alert.providerKey,
  alert.providerRole,
  alert.providerEvidence,
  alert.hazard,
  alert.origin,
  alert.scope,
  alert.action,
  JSON.stringify(alert.lots),
  alert.imageUrl,
  alert.url,
  alert.publishedAt,
  alert.detectedAt,
  alert.updatedAt,
  alert.contentHash,
  alert.versionCount,
  alert.isUpdate ? 1 : 0,
  serializeCanonical(alert.canonical),
  alert.id,
  alert.source
);
var bindSyncStateInsert = (db, state) => db.prepare(`
  INSERT INTO source_sync_state (
    source, mode, status, cursor, plan_version, cursor_key, total_units, pages_scanned, records_observed,
    records_persisted, new_count, updated_count, detail_failures, page_errors,
    oldest_published_at, newest_published_at, coverage, started_at, last_success_at,
    completed_at, last_error, lease_owner_id, lease_mode, lease_expires_at,
    last_skipped_at, last_skip_reason, last_skipped_owner_id, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  state.source,
  state.mode,
  state.status,
  state.cursor,
  state.planVersion ?? null,
  state.cursorKey ?? null,
  state.totalUnits,
  state.pagesScanned,
  state.recordsObserved,
  state.recordsPersisted,
  state.newCount,
  state.updatedCount,
  state.detailFailures,
  state.pageErrors,
  state.oldestPublishedAt,
  state.newestPublishedAt,
  state.coverage,
  state.startedAt,
  state.lastSuccessAt,
  state.completedAt,
  state.lastError?.slice(0, 1e3) ?? null,
  state.leaseOwnerId,
  state.leaseMode,
  state.leaseExpiresAt,
  state.lastSkippedAt,
  state.lastSkipReason,
  state.lastSkippedOwnerId,
  state.updatedAt
);
async function exportOecdSnapshotPayload(targetIds) {
  const db = getD1();
  const targeted = Array.isArray(targetIds);
  const normalizedTargets = targeted ? [...new Set(targetIds.filter((id) => /^oecd:.+/u.test(id)))].sort() : [];
  if (targeted && (!normalizedTargets.length || normalizedTargets.length !== targetIds.length || normalizedTargets.length > 250)) {
    throw new Error("El snapshot dirigido OECD requiere entre 1 y 250 identidades \xFAnicas v\xE1lidas");
  }
  const [count, checkRows, checkMax, stateRows] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM alerts").first(),
    targeted ? Promise.resolve({ results: [] }) : db.prepare(`SELECT id, source, checked_at AS checkedAt, status, found_count AS foundCount,
      changed_count AS changedCount, error FROM source_checks WHERE source = 'OECD' ORDER BY id`).all(),
    db.prepare("SELECT MAX(id) AS maxId FROM source_checks WHERE source = 'OECD'").first(),
    db.prepare(`${syncStateSelect} WHERE source = 'OECD' ORDER BY mode`).all()
  ]);
  if (!count) throw new Error("No se pudo contar el estado D1 previo al backfill OECD");
  const alerts2 = [];
  const versions = [];
  if (targeted) {
    for (let index2 = 0; index2 < normalizedTargets.length; index2 += 75) {
      const chunk = normalizedTargets.slice(index2, index2 + 75);
      const placeholders = chunk.map(() => "?").join(", ");
      const [alertRows, versionRows] = await Promise.all([
        db.prepare(`${alertsSelect} WHERE source = 'OECD' AND id IN (${placeholders}) ORDER BY id`).bind(...chunk).all(),
        db.prepare(`SELECT v.id, v.alert_id AS alertId, v.content_hash AS contentHash,
          v.snapshot AS snapshotJson, v.detected_at AS detectedAt FROM alert_versions v
          INNER JOIN alerts a ON a.id = v.alert_id WHERE a.source = 'OECD' AND a.id IN (${placeholders}) ORDER BY v.id`).bind(...chunk).all()
      ]);
      alerts2.push(...alertRows.results.map(normalizeDbAlert));
      versions.push(...versionRows.results);
    }
  } else {
    const [alertRows, versionRows] = await Promise.all([
      db.prepare(`${alertsSelect} WHERE source = 'OECD' ORDER BY id`).all(),
      db.prepare(`SELECT v.id, v.alert_id AS alertId, v.content_hash AS contentHash,
        v.snapshot AS snapshotJson, v.detected_at AS detectedAt FROM alert_versions v
        INNER JOIN alerts a ON a.id = v.alert_id WHERE a.source = 'OECD' ORDER BY v.id`).all()
    ]);
    alerts2.push(...alertRows.results.map(normalizeDbAlert));
    versions.push(...versionRows.results);
  }
  return {
    schemaVersion: 1,
    databaseAlertCount: count.count,
    alerts: alerts2,
    versions,
    sourceChecks: checkRows.results,
    syncStates: stateRows.results,
    scope: targeted ? "targeted" : "full",
    ...targeted ? { targetIds: normalizedTargets, sourceCheckMaxId: checkMax?.maxId ?? null } : {}
  };
}
async function saveOecdSnapshotData(snapshot) {
  const { manifest, payload } = snapshot;
  const db = getD1();
  const chunks = JSON.stringify(payload).match(/[\s\S]{1,131072}/g) ?? [""];
  await db.batch([
    db.prepare(`INSERT INTO source_backfill_snapshots (
      id, source, purpose, created_at, alert_count, source_alert_count, version_count,
      checksum, source_data_checksum, status, backfill_started_at, restored_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      manifest.id,
      manifest.source,
      manifest.purpose,
      manifest.createdAt,
      manifest.alertCount,
      manifest.sourceAlertCount,
      manifest.versionCount,
      manifest.checksum,
      manifest.sourceDataChecksum,
      manifest.status,
      manifest.backfillStartedAt,
      manifest.restoredAt
    ),
    ...chunks.map((chunk, sequence) => db.prepare(
      "INSERT INTO source_backfill_snapshot_chunks (snapshot_id, sequence, chunk_text) VALUES (?, ?, ?)"
    ).bind(manifest.id, sequence, chunk))
  ]);
}
async function readOecdSnapshotData(snapshotId) {
  const row = await getD1().prepare(`SELECT id, source, purpose, created_at AS createdAt,
    alert_count AS alertCount, source_alert_count AS sourceAlertCount, version_count AS versionCount,
    checksum, source_data_checksum AS sourceDataChecksum, status, backfill_started_at AS backfillStartedAt,
    restored_at AS restoredAt FROM source_backfill_snapshots WHERE id = ? AND source = 'OECD' LIMIT 1`).bind(snapshotId).first();
  if (!row) return null;
  const chunks = await getD1().prepare(`SELECT chunk_text AS chunkText FROM source_backfill_snapshot_chunks
    WHERE snapshot_id = ? ORDER BY sequence`).bind(snapshotId).all();
  if (!chunks.results.length) throw new Error(`El snapshot ${snapshotId} no contiene payload`);
  return { manifest: row, payload: JSON.parse(chunks.results.map((chunk) => chunk.chunkText).join("")) };
}
async function restoreOecdSnapshotData(snapshot, restoredAt) {
  const db = getD1();
  if (snapshot.payload.scope === "targeted") {
    const targetIds = [...new Set(snapshot.payload.targetIds ?? [])].sort();
    if (!targetIds.length || targetIds.some((id) => !/^oecd:.+/u.test(id))) throw new Error("Snapshot OECD dirigido sin identidades v\xE1lidas");
    const sourceAlerts2 = snapshot.payload.alerts.filter((alert) => alert.source === "OECD" && targetIds.includes(alert.id));
    const alertsById = new Map(sourceAlerts2.map((alert) => [alert.id, alert]));
    let restoredVersions = 0;
    for (const id of targetIds) {
      const alert = alertsById.get(id);
      if (!alert) {
        await db.prepare("DELETE FROM alerts WHERE id = ? AND source = 'OECD'").bind(id).run();
        continue;
      }
      const live = await db.prepare("SELECT id FROM alerts WHERE id = ? AND source = 'OECD' LIMIT 1").bind(id).first();
      if (!live) throw new Error(`Rollback OECD no puede restaurar la fila eliminada ${id} sin sus identidades auxiliares`);
      const versions2 = snapshot.payload.versions.filter((version2) => version2.alertId === id);
      const statements2 = [
        bindAlertRestoreUpdate(db, alert),
        db.prepare("DELETE FROM alert_versions WHERE alert_id = ?").bind(id),
        ...versions2.map((version2) => db.prepare(
          "INSERT INTO alert_versions (id, alert_id, content_hash, snapshot, detected_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(version2.id, version2.alertId, version2.contentHash, version2.snapshotJson, version2.detectedAt)),
        ...dimensionReplacementStatements(db, alert)
      ];
      if (statements2.length > 950) throw new Error(`La alerta ${id} excede el lote at\xF3mico seguro de rollback OECD`);
      await db.batch(statements2);
      restoredVersions += versions2.length;
    }
    const sourceCheckDelete = snapshot.payload.sourceCheckMaxId === null || snapshot.payload.sourceCheckMaxId === void 0 ? db.prepare("DELETE FROM source_checks WHERE source = 'OECD'") : db.prepare("DELETE FROM source_checks WHERE source = 'OECD' AND id > ?").bind(snapshot.payload.sourceCheckMaxId);
    await db.batch([
      sourceCheckDelete,
      db.prepare("DELETE FROM source_sync_state WHERE source = 'OECD'"),
      ...snapshot.payload.syncStates.map((state) => bindSyncStateInsert(db, state)),
      db.prepare("UPDATE source_backfill_snapshots SET status = 'restored', restored_at = ? WHERE id = ? AND source = 'OECD'").bind(restoredAt, snapshot.manifest.id)
    ]);
    return {
      snapshotId: snapshot.manifest.id,
      restoredAlerts: sourceAlerts2.length,
      restoredVersions,
      restoredChecks: 0,
      restoredSyncStates: snapshot.payload.syncStates.length,
      removedReplayAlerts: targetIds.length - sourceAlerts2.length
    };
  }
  const sourceAlerts = filterForOperationalDataset(snapshot.payload.alerts.filter((alert) => alert.source === "OECD"));
  const ids = new Set(sourceAlerts.map((alert) => alert.id));
  const versions = snapshot.payload.versions.filter((version2) => ids.has(version2.alertId));
  const checks = snapshot.payload.sourceChecks.filter((check2) => check2.source === "OECD");
  const states = snapshot.payload.syncStates.filter((state) => state.source === "OECD");
  const statements = [
    db.prepare("DELETE FROM alert_versions WHERE alert_id IN (SELECT id FROM alerts WHERE source = 'OECD')"),
    db.prepare("DELETE FROM alerts WHERE source = 'OECD'"),
    db.prepare("DELETE FROM source_checks WHERE source = 'OECD'"),
    db.prepare("DELETE FROM source_sync_state WHERE source = 'OECD'"),
    ...sourceAlerts.map((alert) => bindAlertInsert(db, alert)),
    ...versions.map((version2) => db.prepare(
      "INSERT INTO alert_versions (id, alert_id, content_hash, snapshot, detected_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(version2.id, version2.alertId, version2.contentHash, version2.snapshotJson, version2.detectedAt)),
    ...checks.map((check2) => db.prepare(`INSERT INTO source_checks
      (id, source, checked_at, status, found_count, changed_count, error) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(check2.id, check2.source, check2.checkedAt, check2.status, check2.foundCount, check2.changedCount, check2.error)),
    ...states.map((state) => bindSyncStateInsert(db, state)),
    db.prepare("UPDATE source_backfill_snapshots SET status = 'restored', restored_at = ? WHERE id = ?").bind(restoredAt, snapshot.manifest.id)
  ];
  if (statements.length > 950) throw new Error("El rollback OECD excede el lote at\xF3mico seguro de D1; no se modific\xF3 ning\xFAn dato");
  await db.batch(statements);
  return {
    snapshotId: snapshot.manifest.id,
    restoredAlerts: sourceAlerts.length,
    restoredVersions: versions.length,
    restoredChecks: checks.length,
    restoredSyncStates: states.length
  };
}
function createD1AlertStore() {
  return {
    async readAlerts() {
      const result = await getD1().prepare(`${alertsSelect} ORDER BY COALESCE(published_at, detected_at) DESC LIMIT 5000`).all();
      const normalized = result.results.map(normalizeDbAlert);
      const canonicalBackfill = result.results.flatMap((row, index2) => !row.canonicalJson || row.canonicalJson === "{}" ? [getD1().prepare("UPDATE alerts SET canonical_json = ? WHERE id = ? AND canonical_json = '{}'").bind(serializeCanonical(normalized[index2].canonical), row.id)] : []);
      if (canonicalBackfill.length) await runBatches(canonicalBackfill);
      return normalized;
    },
    async readAlertViews() {
      const result = await getD1().prepare(`${alertViewsSelect} ORDER BY COALESCE(published_at, detected_at) DESC, id DESC LIMIT 5000`).all();
      return result.results.map(normalizeDbAlertView);
    },
    async readHealth() {
      const result = await getD1().prepare(`
        SELECT s.source, s.status, s.checked_at AS checkedAt, s.found_count AS foundCount,
          s.changed_count AS changedCount, s.error
        FROM source_checks s
        INNER JOIN (SELECT source, MAX(id) AS max_id FROM source_checks GROUP BY source) latest ON latest.max_id = s.id
        ORDER BY s.source
      `).all();
      return result.results.map((row) => ({ ...row, status: row.status === "ok" ? "ok" : "degraded" }));
    },
    async readFreshnessStates() {
      const rows = await getD1().prepare(`SELECT source, checked_at AS checkedAt, status,
        official_latest_identity AS officialLatestIdentity,
        official_latest_published_at AS officialLatestPublishedAt,
        official_latest_updated_at AS officialLatestUpdatedAt,
        nagame_latest_identity AS nagameLatestIdentity,
        nagame_latest_published_at AS nagameLatestPublishedAt,
        nagame_latest_updated_at AS nagameLatestUpdatedAt,
        latest_identity_parity AS latestIdentityParity,
        sample_official_count AS sampleOfficialCount, sample_nagame_count AS sampleNagameCount,
        missing_official_identities AS missingOfficialIdentities,
        unexpected_nagame_identities AS unexpectedNagameIdentities,
        revision_mismatches AS revisionMismatches,
        last_sync_success_at AS lastSyncSuccessAt, sync_age_minutes AS syncAgeMinutes,
        lag_minutes AS lagMinutes, active_lease AS activeLease,
        revision_status AS revisionStatus, revision_last_success_at AS revisionLastSuccessAt,
        revision_age_minutes AS revisionAgeMinutes, revision_cycle_started_at AS revisionCycleStartedAt,
        revision_progress AS revisionProgress, revision_total AS revisionTotal,
        last_successful_parity_at AS lastSuccessfulParityAt, error
        FROM source_freshness_state ORDER BY source`).all();
      const list = (value) => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
        } catch {
          return [];
        }
      };
      return rows.results.map((row) => ({
        ...row,
        latestIdentityParity: Boolean(row.latestIdentityParity),
        activeLease: Boolean(row.activeLease),
        missingOfficialIdentities: list(row.missingOfficialIdentities),
        unexpectedNagameIdentities: list(row.unexpectedNagameIdentities),
        revisionMismatches: list(row.revisionMismatches)
      }));
    },
    async writeFreshnessState(state) {
      await getD1().prepare(`INSERT INTO source_freshness_state (
        source, checked_at, status, official_latest_identity, official_latest_published_at,
        official_latest_updated_at, nagame_latest_identity, nagame_latest_published_at,
        nagame_latest_updated_at, latest_identity_parity, sample_official_count, sample_nagame_count,
        missing_official_identities, unexpected_nagame_identities, revision_mismatches,
        last_sync_success_at, sync_age_minutes, lag_minutes, active_lease,
        revision_status, revision_last_success_at, revision_age_minutes,
        revision_cycle_started_at, revision_progress, revision_total,
        last_successful_parity_at, error, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source) DO UPDATE SET
        checked_at=excluded.checked_at, status=excluded.status,
        official_latest_identity=excluded.official_latest_identity,
        official_latest_published_at=excluded.official_latest_published_at,
        official_latest_updated_at=excluded.official_latest_updated_at,
        nagame_latest_identity=excluded.nagame_latest_identity,
        nagame_latest_published_at=excluded.nagame_latest_published_at,
        nagame_latest_updated_at=excluded.nagame_latest_updated_at,
        latest_identity_parity=excluded.latest_identity_parity,
        sample_official_count=excluded.sample_official_count,
        sample_nagame_count=excluded.sample_nagame_count,
        missing_official_identities=excluded.missing_official_identities,
        unexpected_nagame_identities=excluded.unexpected_nagame_identities,
        revision_mismatches=excluded.revision_mismatches,
        last_sync_success_at=excluded.last_sync_success_at,
        sync_age_minutes=excluded.sync_age_minutes, lag_minutes=excluded.lag_minutes,
        active_lease=excluded.active_lease,
        revision_status=excluded.revision_status,
        revision_last_success_at=excluded.revision_last_success_at,
        revision_age_minutes=excluded.revision_age_minutes,
        revision_cycle_started_at=excluded.revision_cycle_started_at,
        revision_progress=excluded.revision_progress, revision_total=excluded.revision_total,
        last_successful_parity_at=excluded.last_successful_parity_at,
        error=excluded.error, updated_at=excluded.updated_at`).bind(
        state.source,
        state.checkedAt,
        state.status,
        state.officialLatestIdentity,
        state.officialLatestPublishedAt,
        state.officialLatestUpdatedAt,
        state.nagameLatestIdentity,
        state.nagameLatestPublishedAt,
        state.nagameLatestUpdatedAt,
        state.latestIdentityParity ? 1 : 0,
        state.sampleOfficialCount,
        state.sampleNagameCount,
        JSON.stringify(state.missingOfficialIdentities),
        JSON.stringify(state.unexpectedNagameIdentities),
        JSON.stringify(state.revisionMismatches),
        state.lastSyncSuccessAt,
        state.syncAgeMinutes,
        state.lagMinutes,
        state.activeLease ? 1 : 0,
        state.revisionStatus ?? "unknown",
        state.revisionLastSuccessAt ?? null,
        state.revisionAgeMinutes ?? null,
        state.revisionCycleStartedAt ?? null,
        state.revisionProgress ?? null,
        state.revisionTotal ?? null,
        state.lastSuccessfulParityAt,
        state.error?.slice(0, 2e3) ?? null,
        state.checkedAt
      ).run();
    },
    async readFreshnessSample(source, limit) {
      const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
      const order = source === "RAPNA" ? "COALESCE(json_extract(canonical_json, '$.dates.officialUpdatedAt.normalized'), updated_at) DESC, id DESC" : "COALESCE(published_at, detected_at) DESC, id DESC";
      const rows = await getD1().prepare(`${alertsSelect} WHERE source = ? ORDER BY ${order} LIMIT ?`).bind(source, safeLimit).all();
      return rows.results.map(normalizeDbAlert);
    },
    async readAlertsByReferences(source, references) {
      const rows = [];
      for (const chunk of chunkAlertReferencesForRead(references)) {
        const placeholders = chunk.map(() => "?").join(", ");
        const result = await getD1().prepare(`${alertsSelect} WHERE source = ? AND reference IN (${placeholders})`).bind(source, ...chunk).all();
        rows.push(...result.results);
      }
      return rows.map(normalizeDbAlert);
    },
    async readRapnaReferencesByArchive(archive) {
      const rows = await getD1().prepare(`
        SELECT reference FROM alerts
        WHERE source = 'RAPNA' AND json_extract(canonical_json, '$.sourceRecord.archive') = ?
        ORDER BY reference
      `).bind(archive).all();
      return rows.results.map((row) => row.reference);
    },
    async readAlertReconciliationCandidates(source, ids, references) {
      const normalizedIds = [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
      const normalizedReferences = [...new Set(references.map((value) => value.trim()).filter(Boolean))];
      const candidates = /* @__PURE__ */ new Map();
      const add = (row, matchedId, matchedReference) => {
        const candidate = candidates.get(row.id) ?? {
          row,
          matchedIds: /* @__PURE__ */ new Set(),
          matchedReferences: /* @__PURE__ */ new Set()
        };
        if (matchedId) candidate.matchedIds.add(matchedId);
        if (matchedReference) candidate.matchedReferences.add(matchedReference);
        candidates.set(row.id, candidate);
      };
      const loadAlerts = async (column, values, recordMatch = true) => {
        for (let index2 = 0; index2 < values.length; index2 += 75) {
          const chunk = values.slice(index2, index2 + 75);
          const placeholders = chunk.map(() => "?").join(", ");
          const result = await getD1().prepare(`${alertsSelect} WHERE source = ? AND ${column} IN (${placeholders})`).bind(source, ...chunk).all();
          for (const row of result.results) {
            add(
              row,
              recordMatch && column === "id" ? row.id : void 0,
              recordMatch && column === "reference" ? row.reference : void 0
            );
          }
        }
      };
      await loadAlerts("id", normalizedIds);
      await loadAlerts("reference", normalizedReferences);
      const aliases = /* @__PURE__ */ new Map();
      for (let index2 = 0; index2 < normalizedReferences.length; index2 += 75) {
        const chunk = normalizedReferences.slice(index2, index2 + 75);
        const placeholders = chunk.map(() => "?").join(", ");
        const result = await getD1().prepare(`SELECT alert_id AS alertId, alias_value AS aliasValue
          FROM alert_aliases WHERE source = ? AND alias_type = 'reference'
          AND alias_value IN (${placeholders})`).bind(source, ...chunk).all();
        for (const row of result.results) {
          const values = aliases.get(row.alertId) ?? /* @__PURE__ */ new Set();
          values.add(row.aliasValue);
          aliases.set(row.alertId, values);
        }
      }
      const aliasAlertIds = [...aliases.keys()];
      await loadAlerts("id", aliasAlertIds, false);
      for (const [alertId, aliasValues] of aliases) {
        const candidate = candidates.get(alertId);
        if (!candidate) throw new Error(`${source}: alias de referencia apunta a alerta inexistente ${alertId}`);
        for (const value of aliasValues) candidate.matchedReferences.add(value);
      }
      return [...candidates.values()].sort((left, right) => left.row.id.localeCompare(right.row.id, "en")).map((candidate) => ({
        alert: normalizeDbAlert(candidate.row),
        matchedIds: [...candidate.matchedIds].sort(),
        matchedReferences: [...candidate.matchedReferences].sort()
      }));
    },
    async shouldRefresh({ force, repairNeeded, expectedSources }) {
      if (repairNeeded) return true;
      const health = await this.readHealth();
      if (force && health.every((item) => !item.checkedAt || Date.now() - new Date(item.checkedAt).getTime() > 6e4)) return true;
      if (health.length < expectedSources) return true;
      return health.some((item) => !item.checkedAt || Date.now() - new Date(item.checkedAt).getTime() > 15 * 6e4);
    },
    async readAesanProducerSeed() {
      const rows = await getD1().prepare(`${alertsSelect} WHERE source = 'AESAN' ORDER BY id LIMIT 5001`).all();
      if (rows.results.length >= 5e3) throw new Error("AESAN producer seed exceeds bound");
      return rows.results.map(normalizeDbAlert);
    },
    async persistSuccess(source, incoming, fence) {
      const base = getD1();
      const db = fence ? Object.assign(Object.create(base), {
        prepare: base.prepare.bind(base),
        batch: async (statements) => {
          const guard = base.prepare(`SELECT CASE WHEN EXISTS (
            SELECT 1 FROM source_sync_locks WHERE source = ? AND owner_id = ? AND expires_at > ?
          ) THEN 1 ELSE json('source-lease-fence-lost') END`).bind(source, fence.ownerId, fence.now());
          try {
            return (await base.batch([guard, ...statements])).slice(1);
          } catch (error) {
            throw new UnknownSourcePersistenceError(error);
          }
        }
      }) : base;
      const eligibleIncoming = filterForOperationalDataset(incoming);
      const existingById = /* @__PURE__ */ new Map();
      const existingByReference = /* @__PURE__ */ new Map();
      const existingByUrl = /* @__PURE__ */ new Map();
      const identityBySourceRecord = /* @__PURE__ */ new Map();
      const identityByAlertId = /* @__PURE__ */ new Map();
      const dimensionState = /* @__PURE__ */ new Map();
      const ids = [...new Set(eligibleIncoming.map((alert) => alert.id))];
      const references = [...new Set(eligibleIncoming.map((alert) => alert.reference))];
      const urls = source === "AESAN" ? [...new Set(eligibleIncoming.map((alert) => alert.url).filter(isOfficialAesanUrl))] : [];
      const sourceRecordIds = [...new Set(eligibleIncoming.map(sourceRecordIdFor))];
      if (sourceRecordIds.some((value) => !value)) {
        throw new SourceIdentityConflictError(`${source}: sourceRecordId vac\xEDo; lote rechazado antes de escribir`);
      }
      const incomingIdentityOwners = /* @__PURE__ */ new Map();
      const incomingReferenceOwners = /* @__PURE__ */ new Map();
      const incomingUrlOwners = /* @__PURE__ */ new Map();
      for (const alert of eligibleIncoming) {
        const sourceRecordId = sourceRecordIdFor(alert);
        const identityOwner = incomingIdentityOwners.get(sourceRecordId);
        if (identityOwner && (identityOwner.id !== alert.id || identityOwner.url !== alert.url || identityOwner.reference !== alert.reference)) {
          throw new SourceIdentityConflictError(`${source}: sourceRecordId ${sourceRecordId} aparece en entidades simult\xE1neas incompatibles`);
        }
        incomingIdentityOwners.set(sourceRecordId, alert);
        const referenceOwner = incomingReferenceOwners.get(alert.reference);
        if (referenceOwner && sourceRecordIdFor(referenceOwner) !== sourceRecordId) {
          throw new SourceIdentityConflictError(`${source}: referencia ${alert.reference} llega con identidades distintas`);
        }
        incomingReferenceOwners.set(alert.reference, alert);
        if (source === "AESAN" && isOfficialAesanUrl(alert.url)) {
          const urlOwner = incomingUrlOwners.get(alert.url);
          if (urlOwner && sourceRecordIdFor(urlOwner) !== sourceRecordId) {
            throw new SourceIdentityConflictError(`${source}: URL oficial ${alert.url} llega con identidades distintas`);
          }
          incomingUrlOwners.set(alert.url, alert);
        }
      }
      for (let index2 = 0; index2 < sourceRecordIds.length; index2 += 75) {
        const chunk = sourceRecordIds.slice(index2, index2 + 75);
        const placeholders = chunk.map(() => "?").join(", ");
        const rows = await db.prepare(`SELECT alert_id AS alertId, source_record_id AS sourceRecordId
          FROM alert_source_identities WHERE source = ? AND source_record_id IN (${placeholders})`).bind(source, ...chunk).all();
        for (const row of rows.results) {
          identityBySourceRecord.set(row.sourceRecordId, row);
          identityByAlertId.set(row.alertId, row);
        }
      }
      const loadCandidates = async (column, values) => {
        for (let index2 = 0; index2 < values.length; index2 += 75) {
          const chunk = values.slice(index2, index2 + 75);
          const placeholders = chunk.map(() => "?").join(", ");
          const rows = await db.prepare(`SELECT id, reference, source, hazard, url, detected_at AS detectedAt,
            content_hash AS contentHash, canonical_json AS canonicalJson
            FROM alerts WHERE source = ? AND ${column} IN (${placeholders})`).bind(source, ...chunk).all();
          for (const row of rows.results) existingById.set(row.id, row);
        }
      };
      await loadCandidates("id", [...new Set([...ids, ...identityBySourceRecord.values()].map((value) => typeof value === "string" ? value : value.alertId))]);
      await loadCandidates("reference", references);
      if (urls.length) await loadCandidates("url", urls);
      for (const row of existingById.values()) {
        existingByReference.set(row.reference, row);
        const matchingUrl = existingByUrl.get(row.url) ?? [];
        if (!matchingUrl.some((candidate) => candidate.id === row.id)) matchingUrl.push(row);
        existingByUrl.set(row.url, matchingUrl);
      }
      const candidateIds = [...existingById.keys()];
      for (let index2 = 0; index2 < candidateIds.length; index2 += 75) {
        const chunk = candidateIds.slice(index2, index2 + 75);
        const placeholders = chunk.map(() => "?").join(", ");
        const identities = await db.prepare(`SELECT alert_id AS alertId, source_record_id AS sourceRecordId
          FROM alert_source_identities WHERE source = ? AND alert_id IN (${placeholders})`).bind(source, ...chunk).all();
        for (const row of identities.results) {
          identityByAlertId.set(row.alertId, row);
          identityBySourceRecord.set(row.sourceRecordId, row);
        }
        const states = await db.prepare(`SELECT alert_id AS alertId, source_content_hash AS sourceContentHash,
          mapping_version AS mappingVersion FROM alert_dimension_state WHERE alert_id IN (${placeholders})`).bind(...chunk).all();
        for (const row of states.results) dimensionState.set(row.alertId, row);
      }
      const resolvedIncoming = eligibleIncoming.map((alert) => {
        const sourceRecordId = sourceRecordIdFor(alert);
        const stable = identityBySourceRecord.get(sourceRecordId);
        const legacy = /* @__PURE__ */ new Map();
        const byId = existingById.get(alert.id);
        const byReference = existingByReference.get(alert.reference);
        if (byId) legacy.set(byId.id, byId);
        if (byReference) legacy.set(byReference.id, byReference);
        if (source === "AESAN" && isOfficialAesanUrl(alert.url)) {
          for (const row of existingByUrl.get(alert.url) ?? []) legacy.set(row.id, row);
        }
        if (stable) {
          for (const row of legacy.values()) {
            if (row.id !== stable.alertId) {
              throw new SourceIdentityConflictError(
                `${source}: ${sourceRecordId} resuelve a ${stable.alertId}, pero id/referencia/URL tambi\xE9n resuelve a ${row.id}`
              );
            }
          }
        } else if (legacy.size > 1) {
          throw new SourceIdentityConflictError(
            `${source}: ${sourceRecordId} encuentra m\xFAltiples filas legacy (${[...legacy.keys()].sort().join(", ")})`
          );
        }
        const current = stable ? existingById.get(stable.alertId) : [...legacy.values()][0];
        if (stable && !current) {
          throw new SourceIdentityConflictError(`${source}: identidad ${sourceRecordId} apunta a alerta inexistente ${stable.alertId}`);
        }
        if (current) {
          const currentIdentity = identityByAlertId.get(current.id);
          if (currentIdentity && currentIdentity.sourceRecordId !== sourceRecordId) {
            throw new SourceIdentityConflictError(
              `${source}: ${current.id} ya pertenece a ${currentIdentity.sourceRecordId}; no se reasigna a ${sourceRecordId}`
            );
          }
          const referenceOwner = existingByReference.get(alert.reference);
          if (referenceOwner && referenceOwner.id !== current.id) {
            throw new SourceIdentityConflictError(
              `${source}: referencia destino ${alert.reference} ya est\xE1 ocupada por ${referenceOwner.id}`
            );
          }
          const canonical = { ...alert.canonical, dates: { ...alert.canonical.dates, detectedAt: current.detectedAt } };
          return withInternalId({ ...alert, detectedAt: current.detectedAt, canonical }, current.id);
        }
        return alert;
      });
      const existing = existingById;
      const protectedIncoming = resolvedIncoming.filter((alert) => {
        if (source !== "OECD" || alert.canonical.sourceRecord?.detailLevel === "detail") return true;
        const current = existing.get(alert.id);
        if (!current?.canonicalJson) return true;
        try {
          const canonical = JSON.parse(current.canonicalJson);
          return canonical.sourceRecord?.detailLevel !== "detail";
        } catch {
          return true;
        }
      });
      const publishedBaselines = new Set(protectedIncoming.flatMap((alert) => {
        const current = existing.get(alert.id);
        return current && isInitialAesanPublishedBaseline(current.canonicalJson, alert.canonical) ? [alert.id] : [];
      }));
      const rapnaParserRepairBaselines = new Set(protectedIncoming.flatMap((alert) => {
        const current = existing.get(alert.id);
        return current && isInitialRapnaParserRepairBaseline(current.canonicalJson, alert.canonical) ? [alert.id] : [];
      }));
      const rapnaLegacyParserRepairBaselines = new Set(protectedIncoming.flatMap((alert) => {
        const current = existing.get(alert.id);
        return current && isInitialRapnaLegacyParserRepairBaseline(current.canonicalJson, alert.canonical) ? [alert.id] : [];
      }));
      const safetyGateParserBaselines = new Set(protectedIncoming.flatMap((alert) => {
        const current = existing.get(alert.id);
        return current && current.contentHash !== alert.contentHash && isInitialSafetyGateParserBaseline(current.canonicalJson, alert.canonical) ? [alert.id] : [];
      }));
      const oecdParserBaselines = new Set(protectedIncoming.flatMap((alert) => {
        const current = existing.get(alert.id);
        return current && current.contentHash !== alert.contentHash && isInitialOecdParserBaseline(current.canonicalJson, alert.canonical) ? [alert.id] : [];
      }));
      const metadataBaselines = /* @__PURE__ */ new Set([
        ...publishedBaselines,
        ...rapnaParserRepairBaselines,
        ...rapnaLegacyParserRepairBaselines,
        ...safetyGateParserBaselines,
        ...oecdParserBaselines
      ]);
      const aliasClaims = protectedIncoming.flatMap((alert) => {
        const current = existing.get(alert.id);
        const references2 = new Set(previousReferencesFor(alert));
        if (current && current.reference !== alert.reference) references2.add(current.reference);
        return [...references2].sort().map((aliasValue) => ({ alertId: alert.id, aliasValue }));
      });
      const aliasValues = [...new Set(aliasClaims.map((claim) => claim.aliasValue))];
      const existingAliases = /* @__PURE__ */ new Map();
      for (let index2 = 0; index2 < aliasValues.length; index2 += 75) {
        const chunk = aliasValues.slice(index2, index2 + 75);
        const placeholders = chunk.map(() => "?").join(", ");
        const rows = await db.prepare(`SELECT alert_id AS alertId, alias_value AS aliasValue FROM alert_aliases
          WHERE source = ? AND alias_type = 'reference' AND alias_value IN (${placeholders})`).bind(source, ...chunk).all();
        for (const row of rows.results) existingAliases.set(row.aliasValue, row);
      }
      for (const claim of aliasClaims) {
        const aliasOwner = existingAliases.get(claim.aliasValue);
        const activeOwner = existingByReference.get(claim.aliasValue);
        if (aliasOwner && aliasOwner.alertId !== claim.alertId || activeOwner && activeOwner.id !== claim.alertId) {
          throw new SourceIdentityConflictError(
            `${source}: alias hist\xF3rico ${claim.aliasValue} pertenece a otra alerta; no se reasigna`
          );
        }
      }
      const changed = protectedIncoming.filter((alert) => {
        const current = existing.get(alert.id);
        if (!current) return true;
        if (metadataBaselines.has(alert.id)) return false;
        if (!current.canonicalJson || current.canonicalJson === "{}") return false;
        return current.contentHash !== alert.contentHash;
      });
      const newCount = protectedIncoming.filter((alert) => !existing.has(alert.id)).length;
      const updatedCount = changed.length - newCount;
      const canonicalRefreshes = new Map(protectedIncoming.flatMap((alert) => {
        const current = existing.get(alert.id);
        const baseline = metadataBaselines.has(alert.id);
        return current && (baseline || current.contentHash === alert.contentHash && canonicalMetadataChanged(current.canonicalJson, alert.canonical)) ? [[alert.id, {
          canonical: canonicalForMetadataRefresh(current.canonicalJson, alert.canonical, current.detectedAt),
          contentHash: baseline ? alert.contentHash : current.contentHash
        }]] : [];
      }));
      const toPersist = protectedIncoming.filter((alert) => {
        const current = existing.get(alert.id);
        return !metadataBaselines.has(alert.id) && (!current || !current.canonicalJson || current.canonicalJson === "{}" || current.contentHash !== alert.contentHash);
      });
      const upserts = toPersist.map((alert) => db.prepare(`
          INSERT INTO alerts (
            id, reference, source, type, priority, title, product, brand,
            product_class, product_key, brand_key, provider, provider_key, provider_role, provider_evidence,
            hazard, origin, scope, action,
            lots, image_url, url, published_at, detected_at, updated_at, content_hash, version_count, is_update, canonical_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            reference=excluded.reference, source=excluded.source, type=excluded.type, priority=excluded.priority, title=excluded.title,
            product=excluded.product, brand=excluded.brand, product_class=excluded.product_class,
            product_key=excluded.product_key, brand_key=excluded.brand_key, provider=excluded.provider,
            provider_key=excluded.provider_key, provider_role=excluded.provider_role, provider_evidence=excluded.provider_evidence,
            hazard=excluded.hazard, origin=excluded.origin,
            scope=excluded.scope, action=excluded.action, lots=excluded.lots, image_url=excluded.image_url,
            url=excluded.url, published_at=CASE
              WHEN ${safetyGateOfficialNullPublicationSql("excluded.canonical_json", "excluded.source", "excluded.published_at")}
                THEN NULL
              ELSE COALESCE(excluded.published_at, alerts.published_at) END,
            updated_at=CASE WHEN alerts.canonical_json <> '{}' AND alerts.content_hash <> excluded.content_hash THEN excluded.updated_at ELSE alerts.updated_at END,
            is_update=excluded.is_update,
            version_count=CASE WHEN alerts.canonical_json <> '{}' AND alerts.content_hash <> excluded.content_hash THEN
              (SELECT COUNT(*) FROM alert_versions WHERE alert_id = alerts.id) +
              CASE WHEN EXISTS (SELECT 1 FROM alert_versions WHERE alert_id = alerts.id AND content_hash = excluded.content_hash)
                THEN 0 ELSE 1 END
              ELSE alerts.version_count END,
            content_hash=excluded.content_hash,
            canonical_json=excluded.canonical_json
        `).bind(
        alert.id,
        alert.reference,
        alert.source,
        alert.type,
        alert.priority,
        alert.title,
        alert.product,
        alert.brand,
        alert.productClass,
        alert.productKey,
        alert.brandKey,
        alert.provider,
        alert.providerKey,
        alert.providerRole,
        alert.providerEvidence,
        alert.hazard,
        alert.origin,
        alert.scope,
        alert.action,
        JSON.stringify(alert.lots),
        alert.imageUrl,
        alert.url,
        alert.publishedAt,
        alert.detectedAt,
        alert.updatedAt,
        alert.contentHash,
        alert.isUpdate ? 1 : 0,
        serializeCanonical(alert.canonical)
      ));
      const versionedIds = new Set(changed.map((alert) => alert.id));
      for (let offset = 0; offset < toPersist.length; offset += 25) {
        const statements = [];
        for (let index2 = offset; index2 < Math.min(offset + 25, toPersist.length); index2++) {
          const alert = toPersist[index2];
          statements.push(upserts[index2]);
          if (versionedIds.has(alert.id)) {
            statements.push(db.prepare("INSERT OR IGNORE INTO alert_versions (alert_id, content_hash, snapshot) VALUES (?, ?, ?)").bind(alert.id, alert.contentHash, JSON.stringify(alert)));
          }
        }
        await db.batch(statements);
      }
      const identityUpserts = protectedIncoming.filter((alert) => {
        const current = identityByAlertId.get(alert.id);
        return !current || current.sourceRecordId !== sourceRecordIdFor(alert);
      }).map((alert) => db.prepare(`
        INSERT INTO alert_source_identities (source, source_record_id, alert_id) VALUES (?, ?, ?)
        ON CONFLICT(alert_id) DO UPDATE SET source=excluded.source, source_record_id=excluded.source_record_id
        WHERE alert_source_identities.source <> excluded.source
          OR alert_source_identities.source_record_id <> excluded.source_record_id
      `).bind(source, sourceRecordIdFor(alert), alert.id));
      if (identityUpserts.length) await runBatches(identityUpserts, 50, db);
      const aliasInserts = aliasClaims.map((claim) => db.prepare(`INSERT INTO alert_aliases
        (source, alias_type, alias_value, alert_id) VALUES (?, 'reference', ?, ?)
        ON CONFLICT(source, alias_type, alias_value) DO NOTHING`).bind(source, claim.aliasValue, claim.alertId));
      if (aliasInserts.length) await runBatches(aliasInserts, 50, db);
      for (const alert of protectedIncoming) {
        const refresh = canonicalRefreshes.get(alert.id);
        const current = existing.get(alert.id);
        if (!refresh || !current) continue;
        const { canonical, contentHash } = refresh;
        const dimensionAlert = {
          ...alert,
          reference: current.reference,
          source: current.source,
          hazard: current.hazard,
          detectedAt: current.detectedAt,
          contentHash,
          canonical
        };
        const refreshStatement = oecdParserBaselines.has(alert.id) ? db.prepare(`UPDATE alerts SET reference = ?, title = ?, product = ?, brand = ?, product_class = ?,
              hazard = ?, origin = ?, scope = ?, action = ?, lots = ?, image_url = ?, url = ?,
              published_at = COALESCE(?, published_at), is_update = ?, canonical_json = ?, content_hash = ?
              WHERE id = ? AND source = ?`).bind(
          alert.reference,
          alert.title,
          alert.product,
          alert.brand,
          alert.productClass,
          alert.hazard,
          alert.origin,
          alert.scope,
          alert.action,
          JSON.stringify(alert.lots),
          alert.imageUrl,
          alert.url,
          alert.publishedAt,
          alert.isUpdate ? 1 : 0,
          serializeCanonical(canonical),
          contentHash,
          alert.id,
          source
        ) : safetyGateParserBaselines.has(alert.id) ? db.prepare(`UPDATE alerts SET reference = ?, title = ?, product = ?, brand = ?, product_class = ?,
              hazard = ?, origin = ?, scope = ?, action = ?, lots = ?, image_url = ?, url = ?,
              published_at = COALESCE(?, published_at), updated_at = ?, is_update = ?, canonical_json = ?, content_hash = ?
              WHERE id = ? AND source = ?`).bind(
          alert.reference,
          alert.title,
          alert.product,
          alert.brand,
          alert.productClass,
          alert.hazard,
          alert.origin,
          alert.scope,
          alert.action,
          JSON.stringify(alert.lots),
          alert.imageUrl,
          alert.url,
          alert.publishedAt,
          alert.updatedAt,
          alert.isUpdate ? 1 : 0,
          serializeCanonical(canonical),
          contentHash,
          alert.id,
          source
        ) : rapnaLegacyParserRepairBaselines.has(alert.id) ? db.prepare(`UPDATE alerts SET reference = ?, title = ?, product = ?, brand = ?, product_class = ?,
              product_key = ?, brand_key = ?, provider = ?, provider_key = ?, provider_role = ?, provider_evidence = ?,
              hazard = ?, origin = ?, scope = ?, action = ?, lots = ?, image_url = ?, url = ?,
              published_at = COALESCE(?, published_at), is_update = ?, canonical_json = ?, content_hash = ?
              WHERE id = ? AND source = ?`).bind(
          alert.reference,
          alert.title,
          alert.product,
          alert.brand,
          alert.productClass,
          alert.productKey,
          alert.brandKey,
          alert.provider,
          alert.providerKey,
          alert.providerRole,
          alert.providerEvidence,
          alert.hazard,
          alert.origin,
          alert.scope,
          alert.action,
          JSON.stringify(alert.lots),
          alert.imageUrl,
          alert.url,
          alert.publishedAt,
          alert.isUpdate ? 1 : 0,
          serializeCanonical(canonical),
          contentHash,
          alert.id,
          source
        ) : rapnaParserRepairBaselines.has(alert.id) ? db.prepare(`UPDATE alerts SET canonical_json = ?, content_hash = ?, product = ?, product_key = ?, lots = ?, is_update = ?
              WHERE id = ? AND source = ?`).bind(
          serializeCanonical(canonical),
          contentHash,
          alert.product,
          alert.productKey,
          JSON.stringify(alert.lots),
          alert.isUpdate ? 1 : 0,
          alert.id,
          source
        ) : db.prepare("UPDATE alerts SET canonical_json = ?, content_hash = ? WHERE id = ? AND source = ?").bind(serializeCanonical(canonical), contentHash, alert.id, source);
        await db.batch([
          refreshStatement,
          ...dimensionReplacementStatements(db, dimensionAlert)
        ]);
      }
      const dimensionsToPersist = protectedIncoming.filter((alert) => {
        const state = dimensionState.get(alert.id);
        return !canonicalRefreshes.has(alert.id) && (!state || state.sourceContentHash !== alert.contentHash || state.mappingVersion !== dimensionMappingVersionForSource(alert.source));
      });
      for (const alert of dimensionsToPersist) await replaceAlertDimensions(alert, db);
      const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
      const successCheck = db.prepare("INSERT INTO source_checks (source, checked_at, status, found_count, changed_count, error) VALUES (?, ?, 'ok', ?, ?, NULL)").bind(source, checkedAt, incoming.length, changed.length);
      if (fence) await db.batch([successCheck]);
      else await successCheck.run();
      return {
        source,
        status: "ok",
        checkedAt,
        foundCount: incoming.length,
        changedCount: changed.length,
        error: null,
        newCount,
        updatedCount,
        unchangedCount: protectedIncoming.length - changed.length,
        retentionRejectedCount: incoming.length - eligibleIncoming.length
      };
    },
    async persistFailure(source, error, fence) {
      const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
      const message = error instanceof Error ? error.message : "Error de conexi\xF3n no identificado";
      const db = getD1(), statement = db.prepare("INSERT INTO source_checks (source, checked_at, status, found_count, changed_count, error) VALUES (?, ?, 'degraded', 0, 0, ?)").bind(source, checkedAt, message.slice(0, 500));
      if (fence) await db.batch([db.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM source_sync_locks WHERE source=? AND owner_id=? AND expires_at>?) THEN 1 ELSE json('source-lease-fence-lost') END`).bind(source, fence.ownerId, fence.now()), statement]);
      else await statement.run();
      return { source, status: "degraded", checkedAt, foundCount: 0, changedCount: 0, error: message };
    },
    async deleteAlerts(ids) {
      if (!ids.length) return;
      const db = getD1();
      await runBatches(ids.map((id) => db.prepare("DELETE FROM alerts WHERE id = ?").bind(id)));
    },
    async readSyncState(source, mode) {
      const row = await getD1().prepare(`${syncStateSelect} WHERE source = ? AND mode = ? LIMIT 1`).bind(source, mode).first();
      return row ?? null;
    },
    async readRevisionCertification(source, mode) {
      const row = await getD1().prepare(`${revisionCertificationSelect} WHERE source = ? AND mode = ? LIMIT 1`).bind(source, mode).first();
      if (!row) return null;
      let evidence;
      try {
        const parsed = JSON.parse(row.evidenceJson);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid evidence");
        evidence = parsed;
      } catch {
        throw new Error(`Certificaci\xF3n de revisi\xF3n ${source}/${mode} con evidencia malformada`);
      }
      return {
        source: row.source,
        mode: row.mode,
        cycleId: row.cycleId,
        completedAt: row.completedAt,
        totalUnits: row.totalUnits,
        recordsObserved: row.recordsObserved,
        coverage: row.coverage,
        auditStatus: row.auditStatus,
        auditCheckedAt: row.auditCheckedAt,
        evidence,
        updatedAt: row.updatedAt
      };
    },
    async writeRevisionCertification(certification, fence) {
      const db = getD1(), statement = db.prepare(`
        INSERT INTO source_revision_certifications (
          source, mode, cycle_id, completed_at, total_units, records_observed, coverage,
          audit_status, audit_checked_at, evidence_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source, mode) DO UPDATE SET
          cycle_id=excluded.cycle_id, completed_at=excluded.completed_at,
          total_units=excluded.total_units, records_observed=excluded.records_observed,
          coverage=excluded.coverage, audit_status=excluded.audit_status,
          audit_checked_at=excluded.audit_checked_at, evidence_json=excluded.evidence_json,
          updated_at=excluded.updated_at
        WHERE excluded.completed_at >= source_revision_certifications.completed_at
      `).bind(
        certification.source,
        certification.mode,
        certification.cycleId,
        certification.completedAt,
        certification.totalUnits,
        certification.recordsObserved,
        certification.coverage,
        certification.auditStatus,
        certification.auditCheckedAt,
        JSON.stringify(certification.evidence),
        certification.updatedAt
      );
      if (fence) await db.batch([db.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM source_sync_locks WHERE source=? AND owner_id=? AND expires_at>?) THEN 1 ELSE json('source-lease-fence-lost') END`).bind(certification.source, fence.ownerId, fence.now()), statement]);
      else await statement.run();
    },
    async writeSyncState(state) {
      await getD1().prepare(`
        INSERT INTO source_sync_state (
          source, mode, status, cursor, plan_version, cursor_key, total_units, pages_scanned, records_observed,
          records_persisted, new_count, updated_count, detail_failures, page_errors,
          oldest_published_at, newest_published_at, coverage, started_at, last_success_at,
          completed_at, last_error, lease_owner_id, lease_mode, lease_expires_at,
          last_skipped_at, last_skip_reason, last_skipped_owner_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source, mode) DO UPDATE SET
          status=excluded.status, cursor=excluded.cursor, plan_version=excluded.plan_version,
          cursor_key=excluded.cursor_key, total_units=excluded.total_units,
          pages_scanned=excluded.pages_scanned, records_observed=excluded.records_observed,
          records_persisted=excluded.records_persisted, new_count=excluded.new_count,
          updated_count=excluded.updated_count, detail_failures=excluded.detail_failures,
          page_errors=excluded.page_errors, oldest_published_at=excluded.oldest_published_at,
          newest_published_at=excluded.newest_published_at, coverage=excluded.coverage,
          started_at=excluded.started_at, last_success_at=excluded.last_success_at,
          completed_at=excluded.completed_at, last_error=excluded.last_error,
          lease_owner_id=excluded.lease_owner_id, lease_mode=excluded.lease_mode,
          lease_expires_at=excluded.lease_expires_at,
          last_skipped_at=CASE
            WHEN excluded.last_skipped_at IS NOT NULL AND
              (source_sync_state.last_skipped_at IS NULL OR excluded.last_skipped_at >= source_sync_state.last_skipped_at)
              THEN excluded.last_skipped_at ELSE source_sync_state.last_skipped_at END,
          last_skip_reason=CASE
            WHEN excluded.last_skipped_at IS NOT NULL AND
              (source_sync_state.last_skipped_at IS NULL OR excluded.last_skipped_at >= source_sync_state.last_skipped_at)
              THEN excluded.last_skip_reason ELSE source_sync_state.last_skip_reason END,
          last_skipped_owner_id=CASE
            WHEN excluded.last_skipped_at IS NOT NULL AND
              (source_sync_state.last_skipped_at IS NULL OR excluded.last_skipped_at >= source_sync_state.last_skipped_at)
              THEN excluded.last_skipped_owner_id ELSE source_sync_state.last_skipped_owner_id END,
          updated_at=excluded.updated_at
      `).bind(
        state.source,
        state.mode,
        state.status,
        state.cursor,
        state.planVersion ?? null,
        state.cursorKey ?? null,
        state.totalUnits,
        state.pagesScanned,
        state.recordsObserved,
        state.recordsPersisted,
        state.newCount,
        state.updatedCount,
        state.detailFailures,
        state.pageErrors,
        state.oldestPublishedAt,
        state.newestPublishedAt,
        state.coverage,
        state.startedAt,
        state.lastSuccessAt,
        state.completedAt,
        state.lastError?.slice(0, 1e3) ?? null,
        state.leaseOwnerId,
        state.leaseMode,
        state.leaseExpiresAt,
        state.lastSkippedAt,
        state.lastSkipReason,
        state.lastSkippedOwnerId,
        state.updatedAt
      ).run();
    },
    async writeSyncStateIfLeaseOwned(state, ownerId, now) {
      const row = await getD1().prepare(`
        INSERT INTO source_sync_state (
          source, mode, status, cursor, plan_version, cursor_key, total_units, pages_scanned, records_observed,
          records_persisted, new_count, updated_count, detail_failures, page_errors,
          oldest_published_at, newest_published_at, coverage, started_at, last_success_at,
          completed_at, last_error, lease_owner_id, lease_mode, lease_expires_at,
          last_skipped_at, last_skip_reason, last_skipped_owner_id, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM source_sync_locks
        WHERE source = ? AND owner_id = ? AND mode = ? AND expires_at > ?
        ON CONFLICT(source, mode) DO UPDATE SET
          status=excluded.status, cursor=excluded.cursor, plan_version=excluded.plan_version,
          cursor_key=excluded.cursor_key, total_units=excluded.total_units,
          pages_scanned=excluded.pages_scanned, records_observed=excluded.records_observed,
          records_persisted=excluded.records_persisted, new_count=excluded.new_count,
          updated_count=excluded.updated_count, detail_failures=excluded.detail_failures,
          page_errors=excluded.page_errors, oldest_published_at=excluded.oldest_published_at,
          newest_published_at=excluded.newest_published_at, coverage=excluded.coverage,
          started_at=excluded.started_at, last_success_at=excluded.last_success_at,
          completed_at=excluded.completed_at, last_error=excluded.last_error,
          lease_owner_id=excluded.lease_owner_id, lease_mode=excluded.lease_mode,
          lease_expires_at=excluded.lease_expires_at,
          last_skipped_at=CASE
            WHEN excluded.last_skipped_at IS NOT NULL AND
              (source_sync_state.last_skipped_at IS NULL OR excluded.last_skipped_at >= source_sync_state.last_skipped_at)
              THEN excluded.last_skipped_at ELSE source_sync_state.last_skipped_at END,
          last_skip_reason=CASE
            WHEN excluded.last_skipped_at IS NOT NULL AND
              (source_sync_state.last_skipped_at IS NULL OR excluded.last_skipped_at >= source_sync_state.last_skipped_at)
              THEN excluded.last_skip_reason ELSE source_sync_state.last_skip_reason END,
          last_skipped_owner_id=CASE
            WHEN excluded.last_skipped_at IS NOT NULL AND
              (source_sync_state.last_skipped_at IS NULL OR excluded.last_skipped_at >= source_sync_state.last_skipped_at)
              THEN excluded.last_skipped_owner_id ELSE source_sync_state.last_skipped_owner_id END,
          updated_at=excluded.updated_at
        WHERE EXISTS (
          SELECT 1 FROM source_sync_locks
          WHERE source = ? AND owner_id = ? AND mode = ? AND expires_at > ?
        )
        RETURNING source
      `).bind(
        state.source,
        state.mode,
        state.status,
        state.cursor,
        state.planVersion ?? null,
        state.cursorKey ?? null,
        state.totalUnits,
        state.pagesScanned,
        state.recordsObserved,
        state.recordsPersisted,
        state.newCount,
        state.updatedCount,
        state.detailFailures,
        state.pageErrors,
        state.oldestPublishedAt,
        state.newestPublishedAt,
        state.coverage,
        state.startedAt,
        state.lastSuccessAt,
        state.completedAt,
        state.lastError?.slice(0, 1e3) ?? null,
        state.leaseOwnerId,
        state.leaseMode,
        state.leaseExpiresAt,
        state.lastSkippedAt,
        state.lastSkipReason,
        state.lastSkippedOwnerId,
        state.updatedAt,
        state.source,
        ownerId,
        state.mode,
        now,
        state.source,
        ownerId,
        state.mode,
        now
      ).first();
      return Boolean(row);
    },
    async acquireSyncLease(source, mode, ownerId, now, expiresAt) {
      const db = getD1();
      const acquire = async () => db.prepare(`
        INSERT INTO source_sync_locks (source, owner_id, mode, acquired_at, heartbeat_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(source) DO UPDATE SET
          owner_id=excluded.owner_id, mode=excluded.mode, acquired_at=excluded.acquired_at,
          heartbeat_at=excluded.heartbeat_at, expires_at=excluded.expires_at
        WHERE source_sync_locks.expires_at <= excluded.heartbeat_at
          OR source_sync_locks.owner_id = excluded.owner_id
        RETURNING source, owner_id AS ownerId, mode, acquired_at AS acquiredAt,
          heartbeat_at AS heartbeatAt, expires_at AS expiresAt
      `).bind(source, ownerId, mode, now, now, expiresAt).first();
      const row = await acquire();
      if (row?.ownerId === ownerId) return { acquired: true, lease: row };
      const active = await db.prepare(`${leaseSelect} WHERE source = ? LIMIT 1`).bind(source).first();
      if (active) return { acquired: false, lease: active };
      const retried = await acquire();
      if (!retried) throw new Error("No se pudo resolver la adquisici\xF3n at\xF3mica del lease");
      return { acquired: retried.ownerId === ownerId, lease: retried };
    },
    async renewSyncLease(source, ownerId, now, expiresAt) {
      return await getD1().prepare(`
        UPDATE source_sync_locks SET heartbeat_at = ?, expires_at = ?
        WHERE source = ? AND owner_id = ? AND expires_at > ?
        RETURNING source, owner_id AS ownerId, mode, acquired_at AS acquiredAt,
          heartbeat_at AS heartbeatAt, expires_at AS expiresAt
      `).bind(now, expiresAt, source, ownerId, now).first() ?? null;
    },
    async releaseSyncLease(source, ownerId) {
      const result = await getD1().prepare("DELETE FROM source_sync_locks WHERE source = ? AND owner_id = ?").bind(source, ownerId).run();
      return (result.meta.changes ?? 0) === 1;
    },
    async repairSafetyGateNullPublicationProjectionIfLeaseOwned(ownerId, now) {
      const db = getD1();
      const ownerSql = `SELECT owner_id AS ownerId FROM source_sync_locks
        WHERE source='SAFETY GATE' AND mode='historical-reconcile' AND owner_id=? AND expires_at>?`;
      const result = await db.batch([
        db.prepare(ownerSql).bind(ownerId, now),
        db.prepare(`UPDATE alerts SET published_at=NULL
          WHERE published_at IS NOT NULL
            AND ${safetyGateOfficialNullPublicationSql("canonical_json", "source", "NULL")}
            AND EXISTS (${ownerSql})`).bind(ownerId, now)
      ]);
      const owner = result[0]?.results?.[0];
      return owner?.ownerId === ownerId ? Number(result[1]?.meta?.changes ?? 0) : null;
    },
    async readSyncLease(source) {
      return await getD1().prepare(`${leaseSelect} WHERE source = ? LIMIT 1`).bind(source).first() ?? null;
    },
    async recordSyncSkip(source, mode, ownerId, at, reason = "already-running") {
      const lease = reason === "already-running" ? await this.readSyncLease?.(source) ?? null : null;
      await getD1().prepare(`
        INSERT INTO source_sync_state (
          source, mode, status, cursor, total_units, pages_scanned, records_observed,
          records_persisted, new_count, updated_count, detail_failures, page_errors, coverage,
          lease_owner_id, lease_mode, lease_expires_at, last_skipped_at, last_skip_reason,
          last_skipped_owner_id, updated_at
        ) VALUES (?, ?, 'idle', 0, 0, 0, 0, 0, 0, 0, 0, 0, 'unknown', ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source, mode) DO UPDATE SET
          lease_owner_id=excluded.lease_owner_id, lease_mode=excluded.lease_mode,
          lease_expires_at=excluded.lease_expires_at, last_skipped_at=excluded.last_skipped_at,
          last_skip_reason=excluded.last_skip_reason, last_skipped_owner_id=excluded.last_skipped_owner_id
      `).bind(
        source,
        mode,
        lease?.ownerId ?? null,
        lease?.mode ?? null,
        lease?.expiresAt ?? null,
        at,
        reason,
        ownerId,
        at
      ).run();
    },
    async exportSafetyGateSnapshot() {
      const db = getD1();
      const [alertRows, versionRows, checkRows, stateRows] = await Promise.all([
        db.prepare(`${alertsSelect} ORDER BY id`).all(),
        db.prepare(`
          SELECT id, alert_id AS alertId, content_hash AS contentHash,
            snapshot AS snapshotJson, detected_at AS detectedAt
          FROM alert_versions ORDER BY id
        `).all(),
        db.prepare(`
          SELECT id, source, checked_at AS checkedAt, status, found_count AS foundCount,
            changed_count AS changedCount, error
          FROM source_checks ORDER BY id
        `).all(),
        db.prepare(`${syncStateSelect} ORDER BY source, mode`).all()
      ]);
      return {
        schemaVersion: 1,
        alerts: alertRows.results.map(normalizeDbAlert),
        versions: versionRows.results,
        sourceChecks: checkRows.results,
        syncStates: stateRows.results
      };
    },
    async saveSafetyGateSnapshot(snapshot) {
      const { manifest, payload } = snapshot;
      const db = getD1();
      const payloadJson = JSON.stringify(payload);
      const chunks = payloadJson.match(/[\s\S]{1,131072}/g) ?? [""];
      await db.batch([
        db.prepare(`
        INSERT INTO source_backfill_snapshots (
          id, source, purpose, created_at, alert_count, source_alert_count, version_count,
          checksum, source_data_checksum, status, backfill_started_at, restored_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
          manifest.id,
          manifest.source,
          manifest.purpose,
          manifest.createdAt,
          manifest.alertCount,
          manifest.sourceAlertCount,
          manifest.versionCount,
          manifest.checksum,
          manifest.sourceDataChecksum,
          manifest.status,
          manifest.backfillStartedAt,
          manifest.restoredAt
        ),
        ...chunks.map((chunk, sequence) => db.prepare(`
          INSERT INTO source_backfill_snapshot_chunks (snapshot_id, sequence, chunk_text) VALUES (?, ?, ?)
        `).bind(manifest.id, sequence, chunk))
      ]);
    },
    async readSafetyGateSnapshot(snapshotId) {
      const row = await getD1().prepare(`
        SELECT id, source, purpose, created_at AS createdAt, alert_count AS alertCount,
          source_alert_count AS sourceAlertCount, version_count AS versionCount, checksum,
          source_data_checksum AS sourceDataChecksum, status, backfill_started_at AS backfillStartedAt,
          restored_at AS restoredAt
        FROM source_backfill_snapshots WHERE id = ? LIMIT 1
      `).bind(snapshotId).first();
      if (!row) return null;
      const chunks = await getD1().prepare(`
        SELECT chunk_text AS chunkText FROM source_backfill_snapshot_chunks
        WHERE snapshot_id = ? ORDER BY sequence
      `).bind(snapshotId).all();
      if (!chunks.results.length) throw new Error(`El snapshot ${snapshotId} no contiene payload`);
      const payloadJson = chunks.results.map((chunk) => chunk.chunkText).join("");
      return { manifest: row, payload: JSON.parse(payloadJson) };
    },
    async findSafetyGateSnapshot(statuses) {
      if (!statuses.length) return null;
      const placeholders = statuses.map(() => "?").join(", ");
      const row = await getD1().prepare(`
        SELECT id FROM source_backfill_snapshots
        WHERE source = 'SAFETY GATE' AND purpose = 'pre-backfill' AND status IN (${placeholders})
        ORDER BY created_at DESC LIMIT 1
      `).bind(...statuses).first();
      return row ? await this.readSafetyGateSnapshot?.(row.id) ?? null : null;
    },
    async updateSafetyGateSnapshotStatus(snapshotId, status, at) {
      await getD1().prepare(`
        UPDATE source_backfill_snapshots SET
          status = ?,
          backfill_started_at = CASE WHEN ? = 'backfill-running' THEN COALESCE(backfill_started_at, ?) ELSE backfill_started_at END,
          restored_at = CASE WHEN ? = 'restored' THEN ? ELSE restored_at END
        WHERE id = ? AND source = 'SAFETY GATE'
      `).bind(status, status, at, status, at, snapshotId).run();
    },
    async restoreSafetyGateSnapshot(snapshot, restoredAt) {
      const db = getD1();
      const sourceAlerts = filterForOperationalDataset(snapshot.payload.alerts.filter((alert) => alert.source === "SAFETY GATE"));
      const ids = new Set(sourceAlerts.map((alert) => alert.id));
      const versions = snapshot.payload.versions.filter((version2) => ids.has(version2.alertId));
      const checks = snapshot.payload.sourceChecks.filter((check2) => check2.source === "SAFETY GATE");
      const states = snapshot.payload.syncStates.filter((state) => state.source === "SAFETY GATE");
      const statements = [
        db.prepare("DELETE FROM alert_versions WHERE alert_id IN (SELECT id FROM alerts WHERE source = 'SAFETY GATE')"),
        db.prepare("DELETE FROM alerts WHERE source = 'SAFETY GATE'"),
        db.prepare("DELETE FROM source_checks WHERE source = 'SAFETY GATE'"),
        db.prepare("DELETE FROM source_sync_state WHERE source = 'SAFETY GATE'"),
        ...sourceAlerts.map((alert) => bindAlertInsert(db, alert)),
        ...versions.map((version2) => db.prepare(`
          INSERT INTO alert_versions (id, alert_id, content_hash, snapshot, detected_at) VALUES (?, ?, ?, ?, ?)
        `).bind(version2.id, version2.alertId, version2.contentHash, version2.snapshotJson, version2.detectedAt)),
        ...checks.map((check2) => db.prepare(`
          INSERT INTO source_checks (id, source, checked_at, status, found_count, changed_count, error)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(check2.id, check2.source, check2.checkedAt, check2.status, check2.foundCount, check2.changedCount, check2.error)),
        ...states.map((state) => bindSyncStateInsert(db, state)),
        db.prepare(`
          UPDATE source_backfill_snapshots SET status = 'restored', restored_at = ? WHERE id = ?
        `).bind(restoredAt, snapshot.manifest.id)
      ];
      if (statements.length > 950) {
        throw new Error("El rollback excede el lote at\xF3mico seguro de D1; no se modific\xF3 ning\xFAn dato");
      }
      await db.batch(statements);
      return {
        snapshotId: snapshot.manifest.id,
        restoredAlerts: sourceAlerts.length,
        restoredVersions: versions.length,
        restoredChecks: checks.length,
        restoredSyncStates: states.length
      };
    },
    async exportRapnaSnapshot() {
      const db = getD1();
      const [count, alertRows, versionRows, checkRows, stateRows] = await Promise.all([
        db.prepare("SELECT COUNT(*) AS count FROM alerts").first(),
        db.prepare(`${alertsSelect} WHERE source = 'RAPNA' ORDER BY id`).all(),
        db.prepare(`
          SELECT v.id, v.alert_id AS alertId, v.content_hash AS contentHash,
            v.snapshot AS snapshotJson, v.detected_at AS detectedAt
          FROM alert_versions v
          INNER JOIN alerts a ON a.id = v.alert_id
          WHERE a.source = 'RAPNA' ORDER BY v.id
        `).all(),
        db.prepare(`
          SELECT id, source, checked_at AS checkedAt, status, found_count AS foundCount,
            changed_count AS changedCount, error
          FROM source_checks WHERE source = 'RAPNA' ORDER BY id
        `).all(),
        db.prepare(`${syncStateSelect} WHERE source = 'RAPNA' ORDER BY mode`).all()
      ]);
      if (!count) throw new Error("No se pudo contar el estado D1 previo al backfill RAPNA");
      return {
        schemaVersion: 1,
        databaseAlertCount: count.count,
        alerts: alertRows.results.map(normalizeDbAlert),
        versions: versionRows.results,
        sourceChecks: checkRows.results,
        syncStates: stateRows.results
      };
    },
    async saveRapnaSnapshot(snapshot) {
      const { manifest, payload } = snapshot;
      const db = getD1();
      const chunks = JSON.stringify(payload).match(/[\s\S]{1,131072}/g) ?? [""];
      await db.batch([
        db.prepare(`
          INSERT INTO source_backfill_snapshots (
            id, source, purpose, created_at, alert_count, source_alert_count, version_count,
            checksum, source_data_checksum, status, backfill_started_at, restored_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          manifest.id,
          manifest.source,
          manifest.purpose,
          manifest.createdAt,
          manifest.alertCount,
          manifest.sourceAlertCount,
          manifest.versionCount,
          manifest.checksum,
          manifest.sourceDataChecksum,
          manifest.status,
          manifest.backfillStartedAt,
          manifest.restoredAt
        ),
        ...chunks.map((chunk, sequence) => db.prepare(`
          INSERT INTO source_backfill_snapshot_chunks (snapshot_id, sequence, chunk_text) VALUES (?, ?, ?)
        `).bind(manifest.id, sequence, chunk))
      ]);
    },
    async readRapnaSnapshot(snapshotId) {
      const row = await getD1().prepare(`
        SELECT id, source, purpose, created_at AS createdAt, alert_count AS alertCount,
          source_alert_count AS sourceAlertCount, version_count AS versionCount, checksum,
          source_data_checksum AS sourceDataChecksum, status, backfill_started_at AS backfillStartedAt,
          restored_at AS restoredAt
        FROM source_backfill_snapshots WHERE id = ? AND source = 'RAPNA' LIMIT 1
      `).bind(snapshotId).first();
      if (!row) return null;
      const chunks = await getD1().prepare(`
        SELECT chunk_text AS chunkText FROM source_backfill_snapshot_chunks
        WHERE snapshot_id = ? ORDER BY sequence
      `).bind(snapshotId).all();
      if (!chunks.results.length) throw new Error(`El snapshot ${snapshotId} no contiene payload`);
      return {
        manifest: row,
        payload: JSON.parse(chunks.results.map((chunk) => chunk.chunkText).join(""))
      };
    },
    async findRapnaSnapshot(statuses) {
      if (!statuses.length) return null;
      const placeholders = statuses.map(() => "?").join(", ");
      const row = await getD1().prepare(`
        SELECT id FROM source_backfill_snapshots
        WHERE source = 'RAPNA' AND purpose = 'pre-backfill' AND status IN (${placeholders})
        ORDER BY created_at DESC LIMIT 1
      `).bind(...statuses).first();
      return row ? await this.readRapnaSnapshot?.(row.id) ?? null : null;
    },
    async updateRapnaSnapshotStatus(snapshotId, status, at) {
      await getD1().prepare(`
        UPDATE source_backfill_snapshots SET
          status = ?,
          backfill_started_at = CASE WHEN ? = 'backfill-running' THEN COALESCE(backfill_started_at, ?) ELSE backfill_started_at END,
          restored_at = CASE WHEN ? = 'restored' THEN ? ELSE restored_at END
        WHERE id = ? AND source = 'RAPNA'
      `).bind(status, status, at, status, at, snapshotId).run();
    },
    async beginRapnaCurrentSnapshot(manifest, controlChunkText) {
      const db = getD1();
      await db.batch([
        db.prepare(`
          INSERT INTO source_backfill_snapshots (
            id, source, purpose, created_at, alert_count, source_alert_count, version_count,
            checksum, source_data_checksum, status, backfill_started_at, restored_at
          ) VALUES (?, 'RAPNA', 'pre-current-replay', ?, ?, 0, 0, ?, ?, 'building', NULL, NULL)
        `).bind(manifest.id, manifest.createdAt, manifest.alertCount, manifest.checksum, manifest.sourceDataChecksum),
        db.prepare(`
          INSERT INTO source_backfill_snapshot_chunks (snapshot_id, sequence, chunk_text) VALUES (?, 0, ?)
        `).bind(manifest.id, controlChunkText)
      ]);
    },
    async readRapnaCurrentSnapshotManifest(snapshotId) {
      const row = await getD1().prepare(`
        SELECT id, source, purpose, created_at AS createdAt, alert_count AS alertCount,
          source_alert_count AS sourceAlertCount, version_count AS versionCount, checksum,
          source_data_checksum AS sourceDataChecksum, status, backfill_started_at AS backfillStartedAt,
          restored_at AS restoredAt
        FROM source_backfill_snapshots
        WHERE id = ? AND source = 'RAPNA' AND purpose = 'pre-current-replay' LIMIT 1
      `).bind(snapshotId).first();
      return row ? { ...row, formatVersion: 2 } : null;
    },
    async findRapnaCurrentSnapshotManifest(statuses) {
      if (!statuses.length) return null;
      const placeholders = statuses.map(() => "?").join(", ");
      const row = await getD1().prepare(`
        SELECT id FROM source_backfill_snapshots
        WHERE source = 'RAPNA' AND purpose = 'pre-current-replay' AND status IN (${placeholders})
        ORDER BY created_at DESC, id DESC LIMIT 1
      `).bind(...statuses).first();
      return row ? await this.readRapnaCurrentSnapshotManifest?.(row.id) ?? null : null;
    },
    async readRapnaCurrentSnapshotChunks(snapshotId, afterSequence, limit) {
      const bounded = Math.max(1, Math.min(20, Math.trunc(limit)));
      const rows = await getD1().prepare(`
        SELECT sequence, chunk_text AS chunkText FROM source_backfill_snapshot_chunks
        WHERE snapshot_id = ? AND sequence > ? ORDER BY sequence LIMIT ?
      `).bind(snapshotId, afterSequence, bounded).all();
      return rows.results;
    },
    async readRapnaCurrentSnapshotTail(snapshotId) {
      const stats = await getD1().prepare(`
        SELECT COUNT(*) AS chunkCount, MAX(sequence) AS maxSequence
        FROM source_backfill_snapshot_chunks WHERE snapshot_id = ?
      `).bind(snapshotId).first();
      if (!stats?.chunkCount || stats.maxSequence === null) return null;
      const last = await getD1().prepare(`
        SELECT chunk_text AS chunkText FROM source_backfill_snapshot_chunks
        WHERE snapshot_id = ? AND sequence = ? LIMIT 1
      `).bind(snapshotId, stats.maxSequence).first();
      if (!last) return null;
      return { chunkCount: stats.chunkCount, maxSequence: stats.maxSequence, lastChunkText: last.chunkText };
    },
    async readRapnaCurrentAlertPage(afterId, limit) {
      const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
      const rows = await getD1().prepare(`${alertsSelect}
        WHERE source = 'RAPNA'
          AND json_extract(canonical_json, '$.sourceRecord.archive') = 'current'
          AND id > ? ORDER BY id LIMIT ?
      `).bind(afterId ?? "", bounded).all();
      return rows.results.map(normalizeDbAlert);
    },
    async readRapnaCurrentVersions(alertIds) {
      if (!alertIds.length) return [];
      const boundedIds = alertIds.slice(0, 100);
      const placeholders = boundedIds.map(() => "?").join(", ");
      const rows = await getD1().prepare(`
        SELECT id, alert_id AS alertId, content_hash AS contentHash,
          snapshot AS snapshotJson, detected_at AS detectedAt
        FROM alert_versions WHERE alert_id IN (${placeholders}) ORDER BY alert_id, id
      `).bind(...boundedIds).all();
      return rows.results;
    },
    async appendRapnaCurrentSnapshotChunk(snapshotId, sequence, chunkText, _cursorAfter, capturedAlerts, capturedVersions) {
      const db = getD1();
      const manifest = await this.readRapnaCurrentSnapshotManifest?.(snapshotId);
      if (!manifest || manifest.status !== "building") throw new Error(`El snapshot ${snapshotId} ya no est\xE1 BUILDING`);
      await db.batch([
        db.prepare(`
          INSERT INTO source_backfill_snapshot_chunks (snapshot_id, sequence, chunk_text) VALUES (?, ?, ?)
        `).bind(snapshotId, sequence, chunkText),
        db.prepare(`
          UPDATE source_backfill_snapshots SET source_alert_count = ?, version_count = ?
          WHERE id = ? AND source = 'RAPNA' AND purpose = 'pre-current-replay' AND status = 'building'
        `).bind(capturedAlerts, capturedVersions, snapshotId)
      ]);
    },
    async finalizeRapnaCurrentSnapshot(snapshotId, checksum, sourceDataChecksum, sourceAlertCount, versionCount) {
      const result = await getD1().prepare(`
        UPDATE source_backfill_snapshots SET checksum = ?, source_data_checksum = ?,
          source_alert_count = ?, version_count = ?, status = 'ready'
        WHERE id = ? AND source = 'RAPNA' AND purpose = 'pre-current-replay' AND status = 'building'
      `).bind(checksum, sourceDataChecksum, sourceAlertCount, versionCount, snapshotId).run();
      if ((result.meta?.changes ?? 0) !== 1) throw new Error(`No se pudo finalizar el snapshot ${snapshotId}`);
    },
    async updateRapnaCurrentSnapshotStatus(snapshotId, expected, status, at) {
      if (!expected.length) return false;
      const placeholders = expected.map(() => "?").join(", ");
      const result = await getD1().prepare(`
        UPDATE source_backfill_snapshots SET status = ?,
          backfill_started_at = CASE WHEN ? = 'backfill-running' THEN COALESCE(backfill_started_at, ?) ELSE backfill_started_at END,
          restored_at = CASE WHEN ? = 'restored' THEN ? ELSE restored_at END
        WHERE id = ? AND source = 'RAPNA' AND purpose = 'pre-current-replay'
          AND status IN (${placeholders})
      `).bind(status, status, at, status, at, snapshotId, ...expected).run();
      return (result.meta?.changes ?? 0) === 1;
    },
    async readRapnaCurrentControlState() {
      const db = getD1();
      const [databaseAlerts, currentAlerts, currentVersions, checks, replay] = await Promise.all([
        db.prepare("SELECT COUNT(*) AS count FROM alerts").first(),
        db.prepare(`SELECT COUNT(*) AS count FROM alerts WHERE source = 'RAPNA'
          AND json_extract(canonical_json, '$.sourceRecord.archive') = 'current'`).first(),
        db.prepare(`SELECT COUNT(*) AS count FROM alert_versions v INNER JOIN alerts a ON a.id = v.alert_id
          WHERE a.source = 'RAPNA' AND json_extract(a.canonical_json, '$.sourceRecord.archive') = 'current'`).first(),
        db.prepare("SELECT COUNT(*) AS count, MAX(id) AS maxId FROM source_checks WHERE source = 'RAPNA'").first(),
        db.prepare(`${syncStateSelect} WHERE source = 'RAPNA' AND mode = 'current-replay' LIMIT 1`).first()
      ]);
      return {
        databaseAlertCount: databaseAlerts?.count ?? 0,
        sourceAlertCount: currentAlerts?.count ?? 0,
        versionCount: currentVersions?.count ?? 0,
        sourceChecks: { count: checks?.count ?? 0, maxId: checks?.maxId ?? null },
        currentReplay: replay ?? null
      };
    },
    async restoreRapnaCurrentSnapshotChunk(chunk) {
      const db = getD1();
      let restoredVersions = 0;
      for (const row of chunk.rows) {
        const { alert, versions } = row;
        if (alert.source !== "RAPNA" || alert.canonical.sourceRecord.archive !== "current") {
          throw new Error(`Rollback CURRENT rechaz\xF3 ${alert.id}`);
        }
        const live = await db.prepare("SELECT id FROM alerts WHERE id = ? AND source = 'RAPNA' LIMIT 1").bind(alert.id).first();
        if (!live) throw new Error(`El rollback CURRENT no puede restaurar una fila eliminada sin identidad: ${alert.id}`);
        const statements = [
          bindAlertRestoreUpdate(db, alert),
          db.prepare("DELETE FROM alert_versions WHERE alert_id = ?").bind(alert.id),
          ...versions.map((version2) => db.prepare(`
            INSERT INTO alert_versions (id, alert_id, content_hash, snapshot, detected_at) VALUES (?, ?, ?, ?, ?)
          `).bind(version2.id, version2.alertId, version2.contentHash, version2.snapshotJson, version2.detectedAt)),
          ...dimensionReplacementStatements(db, alert)
        ];
        if (statements.length > 950) throw new Error(`La alerta ${alert.id} excede el lote at\xF3mico seguro de D1`);
        await db.batch(statements);
        restoredVersions += versions.length;
      }
      return { restoredAlerts: chunk.rows.length, restoredVersions };
    },
    async removeRapnaCurrentAlertsAbsentFromSnapshot(snapshotId, limit) {
      const db = getD1();
      const bounded = Math.max(1, Math.min(100, Math.trunc(limit)));
      const rows = await db.prepare(`
        SELECT a.id FROM alerts a
        WHERE a.source = 'RAPNA'
          AND json_extract(a.canonical_json, '$.sourceRecord.archive') = 'current'
          AND NOT EXISTS (
            SELECT 1 FROM source_backfill_snapshot_chunks c, json_each(c.chunk_text, '$.rows') AS r
            WHERE c.snapshot_id = ? AND json_extract(r.value, '$.alert.id') = a.id
          )
        ORDER BY a.id LIMIT ?
      `).bind(snapshotId, bounded).all();
      if (rows.results.length) {
        await runBatches(rows.results.map((row) => db.prepare(
          "DELETE FROM alerts WHERE id = ? AND source = 'RAPNA'"
        ).bind(row.id)));
      }
      return rows.results.length;
    },
    async finalizeRapnaCurrentSnapshotRestore(snapshotId, control, restoredAt) {
      const db = getD1();
      if (control.sourceChecks.maxId === null) {
        await db.prepare("DELETE FROM source_checks WHERE source = 'RAPNA'").run();
      } else {
        await db.prepare("DELETE FROM source_checks WHERE source = 'RAPNA' AND id > ?").bind(control.sourceChecks.maxId).run();
      }
      const checks = await db.prepare("SELECT COUNT(*) AS count, MAX(id) AS maxId FROM source_checks WHERE source = 'RAPNA'").first();
      if ((checks?.count ?? 0) !== control.sourceChecks.count || (checks?.maxId ?? null) !== control.sourceChecks.maxId) {
        throw new Error("El baseline de source_checks RAPNA no puede restaurarse exactamente");
      }
      const statements = [
        db.prepare("DELETE FROM source_sync_state WHERE source = 'RAPNA' AND mode IN ('current-replay', 'current-rollback')")
      ];
      if (control.currentReplay) statements.push(bindSyncStateInsert(db, control.currentReplay));
      statements.push(db.prepare(`UPDATE source_backfill_snapshots SET status = 'restored', restored_at = ?
        WHERE id = ? AND source = 'RAPNA' AND purpose = 'pre-current-replay' AND status = 'restore-running'`).bind(restoredAt, snapshotId));
      await db.batch(statements);
    },
    async restoreRapnaCurrentSnapshot(snapshot, restoredAt) {
      const db = getD1();
      const isCurrent = (alert) => alert.source === "RAPNA" && alert.canonical.sourceRecord.archive === "current";
      const snapshotAlerts = snapshot.payload.alerts.filter(isCurrent).sort((left, right) => left.id.localeCompare(right.id));
      const snapshotIds = new Set(snapshotAlerts.map((alert) => alert.id));
      const versionsByAlert = /* @__PURE__ */ new Map();
      for (const version2 of snapshot.payload.versions) {
        if (!snapshotIds.has(version2.alertId)) continue;
        const values = versionsByAlert.get(version2.alertId) ?? [];
        values.push(version2);
        versionsByAlert.set(version2.alertId, values);
      }
      for (const values of versionsByAlert.values()) values.sort((left, right) => left.id - right.id);
      const liveRows = await db.prepare(`${alertsSelect} WHERE source = 'RAPNA' ORDER BY id`).all();
      const liveCurrent = liveRows.results.map(normalizeDbAlert).filter(isCurrent);
      const liveIds = new Set(liveCurrent.map((alert) => alert.id));
      const missingSnapshotRows = snapshotAlerts.filter((alert) => !liveIds.has(alert.id));
      if (missingSnapshotRows.length) {
        throw new Error(`El rollback CURRENT no puede restaurar filas eliminadas sin identidades: ${missingSnapshotRows[0].id}`);
      }
      let removedReplayAlerts = 0;
      for (const alert of liveCurrent.filter((candidate) => !snapshotIds.has(candidate.id))) {
        await db.batch([db.prepare("DELETE FROM alerts WHERE id = ? AND source = 'RAPNA'").bind(alert.id)]);
        removedReplayAlerts += 1;
      }
      let restoredVersions = 0;
      for (const alert of snapshotAlerts) {
        const versions = versionsByAlert.get(alert.id) ?? [];
        const statements = [
          bindAlertRestoreUpdate(db, alert),
          db.prepare("DELETE FROM alert_versions WHERE alert_id = ?").bind(alert.id),
          ...versions.map((version2) => db.prepare(`
            INSERT INTO alert_versions (id, alert_id, content_hash, snapshot, detected_at) VALUES (?, ?, ?, ?, ?)
          `).bind(version2.id, version2.alertId, version2.contentHash, version2.snapshotJson, version2.detectedAt)),
          ...dimensionReplacementStatements(db, alert)
        ];
        if (statements.length > 950) {
          throw new Error(`La alerta ${alert.id} excede el lote at\xF3mico seguro de D1 durante rollback CURRENT`);
        }
        await db.batch(statements);
        restoredVersions += versions.length;
      }
      const checks = snapshot.payload.sourceChecks.filter((check2) => check2.source === "RAPNA");
      await db.prepare("DELETE FROM source_checks WHERE source = 'RAPNA'").run();
      await runBatches(checks.map((check2) => db.prepare(`
        INSERT INTO source_checks (id, source, checked_at, status, found_count, changed_count, error)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(check2.id, check2.source, check2.checkedAt, check2.status, check2.foundCount, check2.changedCount, check2.error)));
      await db.batch([
        db.prepare("DELETE FROM source_sync_state WHERE source = 'RAPNA' AND mode = 'current-replay'"),
        db.prepare("UPDATE source_backfill_snapshots SET status = 'restored', restored_at = ? WHERE id = ? AND source = 'RAPNA'").bind(restoredAt, snapshot.manifest.id)
      ]);
      return {
        snapshotId: snapshot.manifest.id,
        restoredAlerts: snapshotAlerts.length,
        restoredVersions,
        restoredChecks: checks.length,
        restoredSyncStates: 0,
        removedReplayAlerts
      };
    },
    async readRapnaControlFingerprint() {
      const db = getD1();
      const [alertsCount, rapnaCount, versionsCount, checks, stateRows, lease, snapshots, samples, currentChecksum] = await Promise.all([
        db.prepare("SELECT COUNT(*) AS count FROM alerts").first(),
        db.prepare("SELECT COUNT(*) AS count FROM alerts WHERE source = 'RAPNA'").first(),
        db.prepare("SELECT COUNT(*) AS count FROM alert_versions").first(),
        db.prepare("SELECT COUNT(*) AS count, MAX(id) AS maxId FROM source_checks WHERE source = 'RAPNA'").first(),
        db.prepare(`${syncStateSelect} WHERE source = 'RAPNA' ORDER BY mode`).all(),
        db.prepare(`${leaseSelect} WHERE source = 'RAPNA' LIMIT 1`).first(),
        db.prepare(`SELECT id, status, created_at AS createdAt FROM source_backfill_snapshots
          WHERE source = 'RAPNA' ORDER BY created_at, id`).all(),
        db.prepare(`SELECT id, reference, content_hash AS contentHash, version_count AS versionCount,
          is_update AS isUpdate FROM alerts WHERE source = 'RAPNA' ORDER BY id LIMIT 12`).all(),
        rapnaCurrentLiveSourceDataChecksum(this)
      ]);
      return {
        alertsCount: alertsCount?.count ?? 0,
        rapnaCount: rapnaCount?.count ?? 0,
        alertVersionsCount: versionsCount?.count ?? 0,
        sourceChecks: { count: checks?.count ?? 0, maxId: checks?.maxId ?? null },
        syncStates: stateRows.results,
        lease: lease ?? null,
        snapshots: snapshots.results,
        rapnaSourceDataChecksum: currentChecksum.checksum,
        samples: samples.results.map((row) => ({ ...row, isUpdate: Boolean(row.isUpdate) }))
      };
    },
    exportOecdSnapshot: exportOecdSnapshotPayload,
    saveOecdSnapshot: saveOecdSnapshotData,
    readOecdSnapshot: readOecdSnapshotData,
    async findOecdSnapshot(statuses) {
      if (!statuses.length) return null;
      const placeholders = statuses.map(() => "?").join(", ");
      const row = await getD1().prepare(`SELECT id FROM source_backfill_snapshots
        WHERE source = 'OECD' AND purpose = 'pre-backfill' AND status IN (${placeholders})
        ORDER BY created_at DESC LIMIT 1`).bind(...statuses).first();
      return row ? await readOecdSnapshotData(row.id) : null;
    },
    async findOecdReconciliationSnapshot(statuses) {
      if (!statuses.length) return null;
      const placeholders = statuses.map(() => "?").join(", ");
      const row = await getD1().prepare(`SELECT id FROM source_backfill_snapshots
        WHERE source = 'OECD' AND purpose = 'pre-reconciliation' AND status IN (${placeholders})
        ORDER BY created_at DESC LIMIT 1`).bind(...statuses).first();
      return row ? await readOecdSnapshotData(row.id) : null;
    },
    async updateOecdSnapshotStatus(snapshotId, status, at) {
      await getD1().prepare(`UPDATE source_backfill_snapshots SET status = ?,
        backfill_started_at = CASE WHEN ? = 'backfill-running' THEN COALESCE(backfill_started_at, ?) ELSE backfill_started_at END,
        restored_at = CASE WHEN ? = 'restored' THEN ? ELSE restored_at END
        WHERE id = ? AND source = 'OECD'`).bind(status, status, at, status, at, snapshotId).run();
    },
    restoreOecdSnapshot: restoreOecdSnapshotData,
    async readOecdAlertsByPublishedRange(startDate, endDate) {
      const rows = await getD1().prepare(`${alertsSelect} WHERE source = 'OECD'
        AND published_at >= (? || 'T00:00:00.000Z') AND published_at <= (? || 'T23:59:59.999Z') ORDER BY id`).bind(startDate, endDate).all();
      return rows.results.map(normalizeDbAlert);
    }
  };
}
async function auditRasffDatabase() {
  const db = getD1();
  const [counts, integrity, range, productDomains, geography, hazards, samples] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS alerts,
      COALESCE(SUM(CASE WHEN source='AESAN' THEN 1 ELSE 0 END),0) AS aesanAlerts,
      COALESCE(SUM(CASE WHEN source='RAPNA' THEN 1 ELSE 0 END),0) AS rapnaAlerts,
      COALESCE(SUM(CASE WHEN source='RASFF' THEN 1 ELSE 0 END),0) AS rasffAlerts,
      COALESCE(SUM(CASE WHEN source='SAFETY GATE' THEN 1 ELSE 0 END),0) AS safetyGateAlerts,
      COALESCE(SUM(CASE WHEN source='OECD' THEN 1 ELSE 0 END),0) AS oecdAlerts,
      COUNT(DISTINCT CASE WHEN source='RASFF' THEN reference END) AS rasffUniqueReferences,
      (SELECT COUNT(*) FROM alert_source_identities WHERE source='RASFF') AS rasffSourceIdentities,
      (SELECT COUNT(*) FROM alert_versions v INNER JOIN alerts a ON a.id=v.alert_id WHERE a.source='RASFF') AS rasffVersions,
      COALESCE(SUM(CASE WHEN source='RASFF' THEN version_count ELSE 0 END),0) AS rasffVersionCountSum,
      COALESCE(SUM(CASE WHEN source='RASFF' AND version_count>1 THEN 1 ELSE 0 END),0) AS rasffMultipleVersionAlerts,
      COALESCE(SUM(CASE WHEN source='RASFF' AND TRIM(COALESCE(
        json_extract(canonical_json,'$.sourceRecord.detail.subject'), ''))='' THEN 1 ELSE 0 END),0) AS rasffNullSubjectAlerts
      ,COALESCE(SUM(CASE WHEN source='RASFF' AND COALESCE(
        json_type(canonical_json,'$.sourceRecord.detail.product'), '')<>'object' THEN 1 ELSE 0 END),0) AS rasffMissingProductAlerts
      ,COALESCE(SUM(CASE WHEN source='RASFF' AND COALESCE(
        json_type(canonical_json,'$.sourceRecord.detail.product'), '')='object' AND (
        COALESCE(json_type(canonical_json,'$.sourceRecord.detail.product.id'), '') NOT IN ('integer','real') OR
        json_extract(canonical_json,'$.sourceRecord.detail.product.id')<=0
      ) THEN 1 ELSE 0 END),0) AS rasffMissingProductIdAlerts
      ,COALESCE(SUM(CASE WHEN source='RASFF' AND COALESCE(
        json_type(canonical_json,'$.sourceRecord.detail.product'), '')='object' AND TRIM(COALESCE(
        json_extract(canonical_json,'$.sourceRecord.detail.product.description'), ''))='' THEN 1 ELSE 0 END),0) AS rasffNullProductDescriptionAlerts
      ,COALESCE(SUM(CASE WHEN source='RASFF' AND COALESCE(
        json_type(canonical_json,'$.sourceRecord.detail.product'), '')='object' AND
        json_type(canonical_json,'$.sourceRecord.detail.product.id') IN ('integer','real') AND
        json_extract(canonical_json,'$.sourceRecord.detail.product.id')>0 AND TRIM(COALESCE(
        json_extract(canonical_json,'$.sourceRecord.detail.product.description'), ''))='' THEN 1 ELSE 0 END),0) AS rasffProductIdWithoutDescriptionAlerts
      FROM alerts`).first(),
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM (SELECT reference FROM alerts WHERE source='RASFF'
        GROUP BY reference HAVING COUNT(*)>1)) AS duplicateReferenceGroups,
      (SELECT COUNT(*) FROM (SELECT json_extract(canonical_json,'$.sourceRecord.notifId') AS notifId
        FROM alerts WHERE source='RASFF' GROUP BY notifId HAVING COUNT(*)>1)) AS duplicateNotifIdGroups,
      COALESCE(SUM(CASE WHEN a.source='RASFF' AND a.id<>('rasff:' || a.reference) THEN 1 ELSE 0 END),0) AS invalidIdentities,
      COALESCE(SUM(CASE WHEN a.source='RASFF' AND (i.alert_id IS NULL OR i.source<>'RASFF' OR
        i.source_record_id<>a.reference OR i.alert_id<>a.id) THEN 1 ELSE 0 END),0) AS missingOrInvalidSourceIdentities,
      COALESCE(SUM(CASE WHEN a.source='RASFF' AND (a.canonical_json IS NULL OR a.canonical_json='' OR a.canonical_json='{}')
        THEN 1 ELSE 0 END),0) AS emptyCanonicalRows,
      COALESCE(SUM(CASE WHEN a.source='RASFF' AND (json_extract(a.canonical_json,'$.identity.source')<>'RASFF' OR
        json_extract(a.canonical_json,'$.identity.internalId')<>a.id OR
        json_extract(a.canonical_json,'$.identity.sourceRecordId')<>a.reference OR
        json_extract(a.canonical_json,'$.identity.officialReference')<>a.reference OR
        typeof(json_extract(a.canonical_json,'$.sourceRecord.notifId'))<>'integer') THEN 1 ELSE 0 END),0)
        AS canonicalIdentityMismatches,
      COALESCE(SUM(CASE WHEN a.source='RASFF' AND (a.url<>(
        'https://webgate.ec.europa.eu/rasff-window/screen/notification/' ||
        json_extract(a.canonical_json,'$.sourceRecord.notifId')) OR
        json_extract(a.canonical_json,'$.identity.officialUrl')<>a.url) THEN 1 ELSE 0 END),0) AS invalidOfficialUrls,
      COALESCE(SUM(CASE WHEN a.source='RASFF' AND (LENGTH(a.content_hash)<>64 OR
        a.content_hash GLOB '*[^0-9a-f]*') THEN 1 ELSE 0 END),0) AS invalidContentHashes,
      (SELECT COUNT(*) FROM alert_versions v INNER JOIN alerts av ON av.id=v.alert_id WHERE av.source='RASFF' AND
        (LENGTH(v.content_hash)<>64 OR v.content_hash GLOB '*[^0-9a-f]*')) AS invalidVersionHashes,
      (SELECT COUNT(*) FROM alerts av WHERE av.source='RASFF' AND av.version_count<>(
        SELECT COUNT(*) FROM alert_versions v WHERE v.alert_id=av.id)) AS versionCountMismatches,
      COALESCE(SUM(CASE WHEN a.source='RASFF' AND a.published_at<'2020-01-01T00:00:00.000Z' THEN 1 ELSE 0 END),0)
        AS cutoffViolations,
      COALESCE(SUM(CASE WHEN a.source='RASFF' AND a.published_at IS NULL THEN 1 ELSE 0 END),0) AS missingPublishedAt
      FROM alerts a LEFT JOIN alert_source_identities i ON i.alert_id=a.id`).first(),
    db.prepare(`SELECT MIN(published_at) AS oldestPublishedAt, MAX(published_at) AS newestPublishedAt
      FROM alerts WHERE source='RASFF'`).first(),
    db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN d.product_domain='human_food' THEN 1 ELSE 0 END),0) AS humanFood,
      COALESCE(SUM(CASE WHEN d.product_domain='animal_feed' THEN 1 ELSE 0 END),0) AS animalFeed,
      COALESCE(SUM(CASE WHEN d.product_domain='non_food' THEN 1 ELSE 0 END),0) AS nonFood,
      COALESCE(SUM(CASE WHEN d.product_domain='unknown' THEN 1 ELSE 0 END),0) AS unknown,
      COALESCE(SUM(CASE WHEN d.alert_id IS NULL OR d.source_content_hash<>a.content_hash THEN 1 ELSE 0 END),0)
        AS missingOrStaleDimensionState
      FROM alerts a LEFT JOIN alert_dimension_state d ON d.alert_id=a.id WHERE a.source='RASFF'`).first(),
    db.prepare(`SELECT COUNT(g.id) AS rows, COUNT(DISTINCT g.alert_id) AS alertsWithGeography,
      COALESCE(SUM(CASE WHEN g.role='origin' THEN 1 ELSE 0 END),0) AS originRows,
      COALESCE(SUM(CASE WHEN g.role='notifying' THEN 1 ELSE 0 END),0) AS notifyingRows,
      COALESCE(SUM(CASE WHEN g.role='distribution' THEN 1 ELSE 0 END),0) AS distributionRows,
      COALESCE(SUM(CASE WHEN g.role='affected' THEN 1 ELSE 0 END),0) AS affectedRows,
      COALESCE(SUM(CASE WHEN g.status='mapped' THEN 1 ELSE 0 END),0) AS mappedRows,
      COALESCE(SUM(CASE WHEN g.status='unmapped' THEN 1 ELSE 0 END),0) AS unmappedRows
      FROM alert_geographies g INNER JOIN alerts a ON a.id=g.alert_id WHERE a.source='RASFF'`).first(),
    db.prepare(`SELECT COUNT(h.id) AS rows, COUNT(DISTINCT h.alert_id) AS alertsWithHazards,
      COALESCE(SUM(CASE WHEN h.status='mapped' THEN 1 ELSE 0 END),0) AS mappedRows,
      COALESCE(SUM(CASE WHEN h.status='unmapped' THEN 1 ELSE 0 END),0) AS unmappedRows,
      COALESCE(SUM(CASE WHEN h.status='unknown' THEN 1 ELSE 0 END),0) AS unknownRows
      FROM alert_hazards h INNER JOIN alerts a ON a.id=h.alert_id WHERE a.source='RASFF'`).first(),
    db.prepare(`SELECT a.id, a.reference, json_extract(a.canonical_json,'$.sourceRecord.notifId') AS notifId,
      a.url, a.content_hash AS contentHash, a.version_count AS versionCount,
      COALESCE(d.product_domain,'missing') AS productDomain,
      (SELECT COUNT(*) FROM alert_geographies g WHERE g.alert_id=a.id) AS geographyRows,
      (SELECT COUNT(*) FROM alert_hazards h WHERE h.alert_id=a.id) AS hazardRows
      FROM alerts a LEFT JOIN alert_dimension_state d ON d.alert_id=a.id WHERE a.source='RASFF'
      ORDER BY a.published_at DESC, a.id DESC LIMIT 5`).all()
  ]);
  if (!counts || !integrity || !range || !productDomains || !geography || !hazards) {
    throw new Error("No se pudieron calcular las m\xE9tricas de auditor\xEDa RASFF");
  }
  return {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    counts,
    integrity,
    range,
    productDomains,
    geography,
    hazards,
    samples: samples.results
  };
}
async function auditAesanRevisionDatabase() {
  const db = getD1();
  const [counts, integrity, range] = await Promise.all([
    db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN source='AESAN' THEN 1 ELSE 0 END),0) AS aesanAlerts,
      COUNT(DISTINCT CASE WHEN source='AESAN' THEN reference END) AS aesanUniqueReferences,
      (SELECT COUNT(*) FROM alert_source_identities WHERE source='AESAN') AS aesanSourceIdentities,
      (SELECT COUNT(*) FROM alert_versions v INNER JOIN alerts a ON a.id=v.alert_id WHERE a.source='AESAN') AS aesanVersions,
      COALESCE(SUM(CASE WHEN source='AESAN' THEN version_count ELSE 0 END),0) AS aesanVersionCountSum
      FROM alerts`).first(),
    db.prepare(`SELECT
      (SELECT COUNT(*) FROM (SELECT reference FROM alerts WHERE source='AESAN'
        GROUP BY reference HAVING COUNT(*)>1)) AS duplicateReferenceGroups,
      COALESCE(SUM(CASE WHEN a.source='AESAN' AND NOT EXISTS (
        SELECT 1 FROM alert_source_identities i WHERE i.alert_id=a.id AND i.source='AESAN'
      ) THEN 1 ELSE 0 END),0) AS missingSourceIdentities,
      COALESCE(SUM(CASE WHEN a.source='AESAN' AND
        (a.canonical_json IS NULL OR a.canonical_json='' OR a.canonical_json='{}') THEN 1 ELSE 0 END),0) AS emptyCanonicalRows,
      COALESCE(SUM(CASE WHEN a.source='AESAN' AND (
        json_extract(a.canonical_json,'$.identity.source')<>'AESAN' OR
        json_extract(a.canonical_json,'$.identity.internalId')<>a.id OR
        json_extract(a.canonical_json,'$.identity.officialReference')<>a.reference OR
        json_extract(a.canonical_json,'$.identity.officialUrl')<>a.url
      ) THEN 1 ELSE 0 END),0) AS canonicalIdentityMismatches,
      COALESCE(SUM(CASE WHEN a.source='AESAN' AND NOT (
        a.url LIKE 'https://www.aesan.gob.es/%' OR a.url LIKE 'https://aesan.gob.es/%'
      ) THEN 1 ELSE 0 END),0) AS invalidOfficialUrls,
      COALESCE(SUM(CASE WHEN a.source='AESAN' AND
        (LENGTH(a.content_hash)<>64 OR a.content_hash GLOB '*[^0-9a-f]*') THEN 1 ELSE 0 END),0) AS invalidContentHashes,
      (SELECT COUNT(*) FROM alert_versions v INNER JOIN alerts av ON av.id=v.alert_id
        WHERE av.source='AESAN' AND (LENGTH(v.content_hash)<>64 OR v.content_hash GLOB '*[^0-9a-f]*')) AS invalidVersionHashes,
      (SELECT COUNT(*) FROM alerts av WHERE av.source='AESAN' AND av.version_count<>(
        SELECT COUNT(*) FROM alert_versions v WHERE v.alert_id=av.id)) AS versionCountMismatches
      FROM alerts a`).first(),
    db.prepare(`SELECT MIN(COALESCE(published_at,detected_at)) AS oldestPublishedAt,
      MAX(COALESCE(published_at,detected_at)) AS newestPublishedAt
      FROM alerts WHERE source='AESAN'`).first()
  ]);
  if (!counts || !integrity || !range) throw new Error("No se pudieron calcular las m\xE9tricas de revisi\xF3n AESAN");
  return { checkedAt: (/* @__PURE__ */ new Date()).toISOString(), counts, integrity, range };
}
async function auditRapnaDatabase() {
  const db = getD1();
  const [counts, integrity, range, logicalStorage] = await Promise.all([
    db.prepare(`
      SELECT
        COUNT(*) AS alerts,
        COALESCE(SUM(CASE WHEN source = 'AESAN' THEN 1 ELSE 0 END), 0) AS aesanAlerts,
        COALESCE(SUM(CASE WHEN source = 'SAFETY GATE' THEN 1 ELSE 0 END), 0) AS safetyGateAlerts,
        COALESCE(SUM(CASE WHEN source = 'RAPNA' THEN 1 ELSE 0 END), 0) AS rapnaAlerts,
        COUNT(DISTINCT CASE WHEN source = 'RAPNA' THEN reference END) AS rapnaUniqueReferences,
        (SELECT COUNT(*) FROM alert_versions v INNER JOIN alerts a ON a.id = v.alert_id
          WHERE a.source = 'RAPNA') AS rapnaVersions,
        COALESCE(SUM(CASE WHEN source = 'RAPNA' THEN version_count ELSE 0 END), 0) AS rapnaVersionCountSum,
        COALESCE(SUM(CASE WHEN source = 'RAPNA' AND
          json_extract(canonical_json, '$.sourceRecord.archive') = 'current' THEN 1 ELSE 0 END), 0) AS rapnaCurrentAlerts,
        COALESCE(SUM(CASE WHEN source = 'RAPNA' AND
          json_extract(canonical_json, '$.sourceRecord.archive') = 'legacy' THEN 1 ELSE 0 END), 0) AS rapnaLegacyAlerts
      FROM alerts
    `).first(),
    db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM (
          SELECT reference FROM alerts WHERE source = 'RAPNA'
          GROUP BY reference HAVING COUNT(*) > 1
        )) AS duplicateReferenceGroups,
        COALESCE(SUM(CASE WHEN source = 'RAPNA' AND id <> ('rapna:' || reference) THEN 1 ELSE 0 END), 0) AS invalidIdentities,
        COALESCE(SUM(CASE WHEN source = 'RAPNA' AND (canonical_json IS NULL OR canonical_json = '' OR canonical_json = '{}') THEN 1 ELSE 0 END), 0) AS emptyCanonicalRows,
        COALESCE(SUM(CASE WHEN source = 'RAPNA' AND url NOT LIKE 'https://servicios.consumo.gob.es/rapnaPublic/%' THEN 1 ELSE 0 END), 0) AS invalidOfficialUrls
      FROM alerts
    `).first(),
    db.prepare(`
      SELECT MIN(COALESCE(published_at, detected_at)) AS oldestPublishedAt,
        MAX(COALESCE(published_at, detected_at)) AS newestPublishedAt
      FROM alerts WHERE source = 'RAPNA'
    `).first(),
    db.prepare(`
      SELECT
        COALESCE(SUM(LENGTH(canonical_json)), 0) AS allCanonicalJsonBytes,
        (SELECT COALESCE(SUM(LENGTH(snapshot)), 0) FROM alert_versions) AS allVersionSnapshotBytes,
        COALESCE(SUM(CASE WHEN source = 'RAPNA' THEN LENGTH(canonical_json) ELSE 0 END), 0) AS rapnaCanonicalJsonBytes,
        (SELECT COALESCE(SUM(LENGTH(v.snapshot)), 0) FROM alert_versions v
          INNER JOIN alerts a ON a.id = v.alert_id WHERE a.source = 'RAPNA') AS rapnaVersionSnapshotBytes
      FROM alerts
    `).first()
  ]);
  if (!counts || !integrity || !range || !logicalStorage) throw new Error("No se pudieron calcular las m\xE9tricas de auditor\xEDa RAPNA");
  const store = createD1AlertStore();
  const snapshot = await store.findRapnaSnapshot?.(["ready", "backfill-running", "backfill-completed", "restored"]) ?? null;
  let snapshotAudit = null;
  if (snapshot) {
    const before = snapshot.payload.alerts.filter((alert) => alert.source === "RAPNA");
    const current = /* @__PURE__ */ new Map();
    for (let index2 = 0; index2 < before.length; index2 += 75) {
      const chunk = before.slice(index2, index2 + 75);
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = await db.prepare(`
        SELECT id, content_hash AS contentHash, version_count AS versionCount, updated_at AS updatedAt
        FROM alerts WHERE source = 'RAPNA' AND id IN (${placeholders})
      `).bind(...chunk.map((alert) => alert.id)).all();
      for (const row of rows.results) current.set(row.id, row);
    }
    snapshotAudit = {
      id: snapshot.manifest.id,
      status: snapshot.manifest.status,
      checksum: snapshot.manifest.checksum,
      sourceDataChecksum: snapshot.manifest.sourceDataChecksum,
      sourceAlertCount: snapshot.manifest.sourceAlertCount,
      missingRapnaAlerts: before.filter((alert) => !current.has(alert.id)).map((alert) => alert.id),
      changedRapnaAlerts: before.flatMap((alert) => {
        const after = current.get(alert.id);
        if (!after || after.contentHash === alert.contentHash && after.versionCount === alert.versionCount && after.updatedAt === alert.updatedAt) return [];
        return [{
          id: alert.id,
          before: { contentHash: alert.contentHash, versionCount: alert.versionCount, updatedAt: alert.updatedAt },
          after
        }];
      })
    };
  }
  return { checkedAt: (/* @__PURE__ */ new Date()).toISOString(), counts, integrity, range, logicalStorage, snapshot: snapshotAudit };
}
async function auditOecdDatabase() {
  const db = getD1();
  const [counts, integrity, range, logicalStorage] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS alerts,
      COALESCE(SUM(CASE WHEN source='AESAN' THEN 1 ELSE 0 END),0) AS aesanAlerts,
      COALESCE(SUM(CASE WHEN source='SAFETY GATE' THEN 1 ELSE 0 END),0) AS safetyGateAlerts,
      COALESCE(SUM(CASE WHEN source='RAPNA' THEN 1 ELSE 0 END),0) AS rapnaAlerts,
      COALESCE(SUM(CASE WHEN source='OECD' THEN 1 ELSE 0 END),0) AS oecdAlerts,
      COUNT(DISTINCT CASE WHEN source='OECD' THEN reference END) AS oecdUniqueReferences,
      (SELECT COUNT(*) FROM alert_versions v INNER JOIN alerts a ON a.id=v.alert_id WHERE a.source='OECD') AS oecdVersions,
      COALESCE(SUM(CASE WHEN source='OECD' AND version_count>1 THEN 1 ELSE 0 END),0) AS oecdMultipleVersionAlerts,
      COALESCE(SUM(CASE WHEN source='OECD' THEN version_count ELSE 0 END),0) AS oecdVersionCountSum FROM alerts`).first(),
    db.prepare(`SELECT (SELECT COUNT(*) FROM (SELECT reference FROM alerts WHERE source='OECD'
      GROUP BY reference HAVING COUNT(*)>1)) AS duplicateReferenceGroups,
      COALESCE(SUM(CASE WHEN source='OECD' AND id<>('oecd:' || reference) THEN 1 ELSE 0 END),0) AS invalidIdentities,
      COALESCE(SUM(CASE WHEN source='OECD' AND (canonical_json IS NULL OR canonical_json='' OR canonical_json='{}') THEN 1 ELSE 0 END),0) AS emptyCanonicalRows,
      COALESCE(SUM(CASE WHEN source='OECD' AND url NOT LIKE 'https://globalrecalls.oecd.org/#/recalls/%' THEN 1 ELSE 0 END),0) AS invalidOfficialUrls,
      COALESCE(SUM(CASE WHEN source='OECD' AND json_extract(canonical_json,'$.sourceRecord.detail.date')='1900-01-01' THEN 1 ELSE 0 END),0) AS sentinelPublishedDates,
      COALESCE(SUM(CASE WHEN source='OECD' AND published_at IS NULL THEN 1 ELSE 0 END),0) AS missingPublishedAt,
      COALESCE(SUM(CASE WHEN source='OECD' AND type='Sin clasificar' THEN 1 ELSE 0 END),0) AS unclassifiedDomains FROM alerts`).first(),
    db.prepare(`SELECT MIN(COALESCE(published_at,detected_at)) AS oldestPublishedAt,
      MAX(COALESCE(published_at,detected_at)) AS newestPublishedAt FROM alerts WHERE source='OECD'`).first(),
    db.prepare(`SELECT COALESCE(SUM(LENGTH(canonical_json)),0) AS allCanonicalJsonBytes,
      (SELECT COALESCE(SUM(LENGTH(snapshot)),0) FROM alert_versions) AS allVersionSnapshotBytes,
      COALESCE(SUM(CASE WHEN source='OECD' THEN LENGTH(canonical_json) ELSE 0 END),0) AS oecdCanonicalJsonBytes,
      (SELECT COALESCE(SUM(LENGTH(v.snapshot)),0) FROM alert_versions v INNER JOIN alerts a ON a.id=v.alert_id
        WHERE a.source='OECD') AS oecdVersionSnapshotBytes FROM alerts`).first()
  ]);
  if (!counts || !integrity || !range || !logicalStorage) throw new Error("No se pudieron calcular las m\xE9tricas OECD");
  const store = createD1AlertStore();
  const snapshotStatuses = ["ready", "backfill-running", "backfill-completed", "restored"];
  const snapshot = await store.findOecdReconciliationSnapshot?.([...snapshotStatuses]) ?? await store.findOecdSnapshot?.([...snapshotStatuses]) ?? null;
  let snapshotAudit = null;
  if (snapshot) {
    const before = snapshot.payload.alerts.filter((alert) => alert.source === "OECD");
    const current = /* @__PURE__ */ new Map();
    for (let index2 = 0; index2 < before.length; index2 += 75) {
      const chunk = before.slice(index2, index2 + 75);
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = await db.prepare(`SELECT id, content_hash AS contentHash, version_count AS versionCount,
        updated_at AS updatedAt FROM alerts WHERE source='OECD' AND id IN (${placeholders})`).bind(...chunk.map((alert) => alert.id)).all();
      for (const row of rows.results) current.set(row.id, row);
    }
    snapshotAudit = {
      id: snapshot.manifest.id,
      status: snapshot.manifest.status,
      checksum: snapshot.manifest.checksum,
      sourceDataChecksum: snapshot.manifest.sourceDataChecksum,
      sourceAlertCount: snapshot.manifest.sourceAlertCount,
      missingOecdAlerts: before.filter((alert) => !current.has(alert.id)).map((alert) => alert.id),
      changedOecdAlerts: before.flatMap((alert) => {
        const after = current.get(alert.id);
        return !after || after.contentHash === alert.contentHash && after.versionCount === alert.versionCount && after.updatedAt === alert.updatedAt ? [] : [{ id: alert.id, before: { contentHash: alert.contentHash, versionCount: alert.versionCount, updatedAt: alert.updatedAt }, after }];
      })
    };
  }
  const versioned = await db.prepare(`SELECT id, reference, version_count AS versionCount FROM alerts
    WHERE source='OECD' AND version_count>1 ORDER BY version_count DESC, id LIMIT 100`).all();
  const transitions = [];
  for (const alert of versioned.results) {
    const rows = await db.prepare(`SELECT snapshot FROM alert_versions WHERE alert_id=? ORDER BY id`).bind(alert.id).all();
    const snapshots = rows.results.flatMap((row) => {
      try {
        return [JSON.parse(row.snapshot)];
      } catch {
        return [];
      }
    });
    for (let index2 = 1; index2 < snapshots.length; index2 += 1) {
      const before = snapshots[index2 - 1];
      const after = snapshots[index2];
      const beforeFingerprint = oecdOfficialSourceFingerprint(before.canonical);
      const afterFingerprint = oecdOfficialSourceFingerprint(after.canonical);
      let classification = "unknown";
      if (beforeFingerprint && afterFingerprint && beforeFingerprint !== afterFingerprint) classification = "official-content-change";
      else if (beforeFingerprint && beforeFingerprint === afterFingerprint) {
        const beforeRaw = JSON.stringify(before.canonical.sourceRecord.detail);
        const afterRaw = JSON.stringify(after.canonical.sourceRecord.detail);
        if (beforeRaw !== afterRaw) classification = "ordering-noise";
        else {
          const beforeCore = canonicalMetadataComparable(before.canonical);
          const afterCore = canonicalMetadataComparable(after.canonical);
          classification = serializeStable(beforeCore) === serializeStable(afterCore) ? "metadata-only" : "parser-evolution";
        }
      }
      transitions.push({ reference: alert.reference, fromVersion: index2, toVersion: index2 + 1, classification });
    }
  }
  const classifications = {};
  for (const row of transitions) classifications[row.classification] = (classifications[row.classification] ?? 0) + 1;
  return {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    counts,
    integrity,
    range,
    logicalStorage,
    snapshot: snapshotAudit,
    versionAudit: { references: versioned.results.length, transitions: transitions.length, classifications, rows: transitions }
  };
}

// candidate-probe-v4-src/lib/control-plane-auth.ts
var bearerToken = (request2) => {
  const authorization = request2.headers.get("Authorization");
  if (!authorization) return null;
  const match = authorization.match(/^Bearer ([^\s]+)$/u);
  return match?.[1] ?? null;
};
var constantTimeTokenMatch = async (provided, configured) => {
  const encoder = new TextEncoder();
  const [providedHash, configuredHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(configured))
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(configuredHash);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index2 = 0; index2 < length; index2 += 1) {
    difference |= (left[index2] ?? 0) ^ (right[index2] ?? 0);
  }
  return difference === 0;
};
async function isAuthorizedControlPlane(request2) {
  const configured = globalThis.__VIGIA_SYNC_TOKEN__ ?? "";
  const provided = bearerToken(request2);
  if (!configured || !provided) return false;
  return constantTimeTokenMatch(provided, configured);
}

// candidate-probe-v4-src/lib/reliability-budget.ts
var ReliabilityBudgetError = class extends Error {
  constructor() {
    super("RELIABILITY_BUDGET_EXHAUSTED");
  }
};
function boundedOfficialFetch(deadline, maxRequests, fetchImpl = fetch, clock = Date.now) {
  let requests = 0;
  const execute = async (input, init) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (clock() >= deadline || requests >= maxRequests) throw new ReliabilityBudgetError();
      requests++;
      const remaining = Math.max(1, deadline - clock());
      const response = await fetchImpl(input, { ...init, signal: AbortSignal.any([...init?.signal ? [init.signal] : [], AbortSignal.timeout(remaining)]) });
      if (attempt === 0 && (response.status === 429 || response.status >= 500 && response.status <= 599)) {
        const retryAfter = response.headers.get("Retry-After");
        const seconds = retryAfter === null ? 1 : /^\d+$/u.test(retryAfter) ? Number(retryAfter) : Number.isFinite(Date.parse(retryAfter)) ? Math.max(0, Math.ceil((Date.parse(retryAfter) - clock()) / 1e3)) : Infinity;
        if (seconds > 5 || clock() + seconds * 1e3 >= deadline) return response;
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, seconds * 1e3));
        continue;
      }
      return response;
    }
    throw new ReliabilityBudgetError();
  };
  return { fetch: execute, requests: () => requests, assert: () => {
    if (clock() >= deadline) throw new ReliabilityBudgetError();
  } };
}

// candidate-probe-v4-src/lib/aesan-published.ts
var exactText3 = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
var exactOrder = (value) => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
var officialUrl = (value) => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (url.hostname === "aesan.gob.es" || url.hostname.endsWith(".aesan.gob.es")) ? url.href : null;
  } catch {
    return null;
  }
};
var ordered = (values) => [...values].sort((left, right) => left.order - right.order);
function parseAesanPublishedRecord(value) {
  if (!value || typeof value !== "object") return null;
  const record7 = value;
  const officialTitle = exactText3(record7.officialTitle);
  const sourceRecordHash = exactText3(record7.sourceRecordHash);
  if (record7.sourceRecordSchemaVersion !== 2 || !officialTitle || !sourceRecordHash || !/^[0-9a-f]{64}$/u.test(sourceRecordHash)) return null;
  if (!Array.isArray(record7.publishedFields) || !Array.isArray(record7.materialParagraphs) || !Array.isArray(record7.resources) || !Array.isArray(record7.officialDates)) return null;
  const publishedFields = record7.publishedFields.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry;
    const label = exactText3(item.label);
    const fieldValue = exactText3(item.value);
    const sourceField = exactText3(item.sourceField);
    const section = exactText3(item.section);
    const context = exactText3(item.context);
    const order = exactOrder(item.order);
    return label && fieldValue && sourceField && section && context && order !== null ? [{ label, value: fieldValue, sourceField, section, context, order }] : [];
  });
  const materialParagraphs = record7.materialParagraphs.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry;
    const paragraph = exactText3(item.value);
    const sourceField = exactText3(item.sourceField);
    const section = exactText3(item.section);
    const order = exactOrder(item.order);
    return paragraph && sourceField && section && order !== null ? [{ value: paragraph, sourceField, section, order }] : [];
  });
  const resources = record7.resources.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry;
    const kind = item.kind === "image" || item.kind === "document" || item.kind === "link" ? item.kind : null;
    const url = officialUrl(item.url);
    const sourceField = exactText3(item.sourceField);
    const order = exactOrder(item.order);
    const label = item.label === null ? null : exactText3(item.label);
    return kind && url && sourceField && order !== null && (item.label === null || label) ? [{ kind, url, label, sourceField, order }] : [];
  });
  const officialDates = record7.officialDates.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry;
    const dateValue = exactText3(item.value);
    const sourceField = exactText3(item.sourceField);
    const order = exactOrder(item.order);
    const label = item.label === null ? null : exactText3(item.label);
    return dateValue && sourceField && order !== null && (item.label === null || label) ? [{ label, value: dateValue, sourceField, order }] : [];
  });
  if (publishedFields.length !== record7.publishedFields.length || materialParagraphs.length !== record7.materialParagraphs.length || resources.length !== record7.resources.length || officialDates.length !== record7.officialDates.length) return null;
  return {
    sourceRecordSchemaVersion: 2,
    sourceRecordHash,
    officialTitle,
    publishedFields: ordered(publishedFields),
    materialParagraphs: ordered(materialParagraphs),
    resources: ordered(resources),
    officialDates: ordered(officialDates)
  };
}
var aesanPublishedRecord = (canonical) => canonical?.identity.source === "AESAN" ? parseAesanPublishedRecord(canonical.sourceRecord) : null;

// candidate-probe-v4-src/lib/aesan-publications.ts
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
var HASH_PATTERN = /^[0-9a-f]{64}$/u;
var MAX_HISTORY_STATES = 128;
var MAX_PUBLICATIONS = 32;
var MAX_STATES_PER_PUBLICATION = 16;
var MAX_EVIDENCE_BYTES = 512e3;
var MAX_PUBLISHED_FIELDS = 256;
var MAX_PARAGRAPHS = 64;
var MAX_RESOURCES = 64;
var MAX_DATES = 8;
var MAX_TITLE_LENGTH = 2e3;
var MAX_TEXT_LENGTH = 5e4;
var MAX_URL_LENGTH = 2048;
var fail = (code, reference) => {
  throw new Error(`${code}: ${typeof reference === "string" && reference.trim() ? reference.trim() : "referencia no disponible"}`);
};
var text2 = (value) => typeof value === "string" ? value.trim() : "";
var isoDate2 = (value, nullable = false) => {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return void 0;
  return new Date(value).toISOString();
};
var officialAlertUrl = (value) => {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH || !isOfficialAesanAlertUrl(value)) return null;
  try {
    const url = new URL(value);
    return !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};
var officialPath = (value) => new URL(value).pathname.replace(/\/+$/u, "") || "/";
var validIdentity = (id, type, url) => type === "idAlert" ? UUID_PATTERN.test(id) : type === "official_page_path" && id === `official_page_path:${officialPath(url)}`;
var bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
var uniqueOrders = (values) => new Set(values.map(({ order }) => order)).size === values.length;
var stableValue4 = (value) => Array.isArray(value) ? value.map(stableValue4) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en")).map(([key, child]) => [key, stableValue4(child)])) : value;
var sameJson = (left, right) => JSON.stringify(stableValue4(left)) === JSON.stringify(stableValue4(right));
var sha2564 = async (value) => {
  const digest2 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest2)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
var rawMaterialFor = (record7) => ({
  officialTitle: record7.officialTitle,
  publishedFields: record7.publishedFields,
  materialParagraphs: record7.materialParagraphs,
  resources: record7.resources,
  officialDates: record7.officialDates
});
var validateMaterialBounds = (record7, reference) => {
  if (record7.officialTitle.length > MAX_TITLE_LENGTH || record7.publishedFields.length > MAX_PUBLISHED_FIELDS || record7.materialParagraphs.length > MAX_PARAGRAPHS || record7.resources.length > MAX_RESOURCES || record7.officialDates.length > MAX_DATES || !uniqueOrders(record7.publishedFields) || !uniqueOrders(record7.materialParagraphs) || !uniqueOrders(record7.resources) || !uniqueOrders(record7.officialDates) || record7.publishedFields.some(({ label, value, sourceField, section, context }) => label.length > MAX_TITLE_LENGTH || value.length > MAX_TEXT_LENGTH || sourceField.length > 512 || section.length > 128 || context.length > 128) || record7.materialParagraphs.some(({ value, sourceField, section }) => value.length > MAX_TEXT_LENGTH || sourceField.length > 512 || section.length > 128) || record7.resources.some(({ url, label, sourceField }) => url.length > MAX_URL_LENGTH || (label?.length ?? 0) > MAX_TITLE_LENGTH || sourceField.length > 512) || record7.officialDates.some(({ label, value, sourceField }) => (label?.length ?? 0) > 256 || value.length > 256 || sourceField.length > 512)) {
    fail("AESAN_PUBLICATION_LIMIT_EXCEEDED", reference);
  }
};
var parseFeedState = async (value, expectedReferences, ownerReference) => {
  if (!value || typeof value !== "object") fail("AESAN_INVALID_PUBLICATION_HISTORY", ownerReference);
  const item = value;
  const reference = text2(item.reference);
  const sourceRecordId = text2(item.sourceRecordId).toLowerCase();
  const url = officialAlertUrl(item.url);
  const publishedAt = isoDate2(item.publishedAt, true);
  const record7 = parseAesanPublishedRecord(item);
  if (!reference || !expectedReferences.has(reference) || !sourceRecordId || !url || publishedAt === void 0 || !validIdentity(sourceRecordId, item.sourceRecordIdType, url) || !record7) {
    fail("AESAN_INVALID_PUBLICATION_HISTORY", ownerReference);
  }
  const validUrl = url;
  const validPublishedAt = publishedAt;
  const validRecord = record7;
  validateMaterialBounds(validRecord, ownerReference);
  if (await sha2564(rawMaterialFor(item)) !== validRecord.sourceRecordHash) {
    fail("AESAN_PUBLICATION_HASH_MISMATCH", ownerReference);
  }
  return {
    reference,
    sourceRecordId,
    sourceRecordIdType: item.sourceRecordIdType,
    url: validUrl,
    publishedAt: validPublishedAt,
    ...validRecord
  };
};
var aesanPublicationAnchor = (sourceRecordId) => `aesan-publication-${sourceRecordId.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "")}`;
var searchText = (state) => [
  state.officialTitle,
  ...state.publishedFields.flatMap(({ label, value }) => [label, value]),
  ...state.materialParagraphs.map(({ value }) => value),
  ...state.resources.map(({ label }) => label ?? "")
].filter(Boolean).join("\n");
var presentationFor = (evidence, members, reference) => members.map((member) => {
  const publication = evidence.publications.find(({ sourceRecordId, url }) => sourceRecordId === member.sourceRecordId && url === member.url);
  const state = publication?.states.find(({ sourceRecordHash }) => sourceRecordHash === member.sourceRecordHash);
  if (!publication || !state) fail("AESAN_INVALID_PUBLICATION_SELECTION", reference);
  const validPublication = publication;
  const validState = state;
  return {
    ...member,
    anchor: validPublication.anchor,
    officialTitle: validState.officialTitle,
    publishedAt: validState.publishedAt,
    searchText: searchText(validState)
  };
});
var validateIdentities = (states, reference) => {
  const pathByIdentity = /* @__PURE__ */ new Map();
  const identityByPath = /* @__PURE__ */ new Map();
  for (const state of states) {
    const path = officialPath(state.url);
    const previousPath = pathByIdentity.get(state.sourceRecordId);
    if (previousPath && previousPath !== path) fail("AESAN_PUBLICATION_ID_MULTIPLE_PATHS", reference);
    pathByIdentity.set(state.sourceRecordId, path);
    if (state.sourceRecordIdType === "idAlert") {
      const previousId = identityByPath.get(path);
      if (previousId && previousId !== state.sourceRecordId) fail("AESAN_PUBLICATION_UUID_CONFLICT", reference);
      identityByPath.set(path, state.sourceRecordId);
    }
  }
};
async function buildAesanPublicationEvidence(value) {
  const hasHistory = Object.hasOwn(value, "publicationHistory");
  const hasSelection = Object.hasOwn(value, "publicationSelection") && value.publicationSelection !== null;
  if (!hasHistory && !hasSelection) return null;
  const reference = text2(value.reference);
  if (!reference || !Array.isArray(value.publicationHistory) || !value.publicationHistory.length || value.publicationHistory.length > MAX_HISTORY_STATES || bytes(value.publicationHistory) > MAX_EVIDENCE_BYTES) {
    fail("AESAN_INVALID_PUBLICATION_HISTORY", reference);
  }
  const publicationHistory2 = value.publicationHistory;
  const expectedReferences = /* @__PURE__ */ new Set([reference]);
  if (Array.isArray(value.previousReferences)) for (const entry of value.previousReferences) {
    const prior = text2(entry);
    if (prior) expectedReferences.add(prior);
  }
  if (Array.isArray(value.referenceHistory)) for (const entry of value.referenceHistory) {
    if (entry && typeof entry === "object") {
      const prior = text2(entry.reference);
      if (prior) expectedReferences.add(prior);
    }
  }
  const states = [];
  for (const raw of publicationHistory2) states.push(await parseFeedState(raw, expectedReferences, reference));
  validateIdentities(states, reference);
  const publications = [];
  const stateKeys = /* @__PURE__ */ new Set();
  for (const state of states) {
    const key = `${state.sourceRecordId}\0${state.url}\0${state.sourceRecordHash}`;
    if (stateKeys.has(key)) continue;
    stateKeys.add(key);
    let publication = publications.find(({ sourceRecordId, url }) => sourceRecordId === state.sourceRecordId && url === state.url);
    if (!publication) {
      publication = {
        sourceRecordId: state.sourceRecordId,
        sourceRecordIdType: state.sourceRecordIdType,
        url: state.url,
        anchor: aesanPublicationAnchor(state.sourceRecordId),
        states: []
      };
      publications.push(publication);
    }
    publication.states.push(state);
  }
  if (publications.length > MAX_PUBLICATIONS || publications.some(({ states: materialStates }) => materialStates.length > MAX_STATES_PER_PUBLICATION)) fail("AESAN_PUBLICATION_LIMIT_EXCEEDED", reference);
  if (new Set(publications.map(({ anchor }) => anchor)).size !== publications.length) {
    fail("AESAN_PUBLICATION_ANCHOR_CONFLICT", reference);
  }
  const currentId = text2(value.sourceRecordId).toLowerCase();
  const currentUrl = officialAlertUrl(value.url);
  const currentHash = text2(value.sourceRecordHash).toLowerCase();
  if (!currentId || !currentUrl || !HASH_PATTERN.test(currentHash) || !states.some((state) => state.sourceRecordId === currentId && state.url === currentUrl && state.sourceRecordHash === currentHash)) {
    fail("AESAN_PUBLICATION_CURRENT_MISSING", reference);
  }
  const validCurrentUrl = currentUrl;
  let selection;
  if (hasSelection) {
    const raw = value.publicationSelection;
    if (raw.status !== "parallel_publications" || raw.basis !== "reviewed_shared_reference" || raw.chronological !== false || !Array.isArray(raw.members) || raw.members.length < 2 || raw.members.length > MAX_PUBLICATIONS) {
      fail("AESAN_INVALID_PUBLICATION_SELECTION", reference);
    }
    const anchorSourceRecordId = text2(raw.anchorSourceRecordId).toLowerCase();
    const rawMembers = raw.members;
    const members = rawMembers.map((member) => {
      if (!member || typeof member !== "object") fail("AESAN_INVALID_PUBLICATION_SELECTION", reference);
      const item = member;
      const sourceRecordId = text2(item.sourceRecordId).toLowerCase();
      const url = officialAlertUrl(item.url);
      const sourceRecordHash = text2(item.sourceRecordHash).toLowerCase();
      if (!sourceRecordId || !url || !HASH_PATTERN.test(sourceRecordHash)) fail("AESAN_INVALID_PUBLICATION_SELECTION", reference);
      return { sourceRecordId, url, sourceRecordHash };
    });
    const anchorMember = members.find(({ sourceRecordId }) => sourceRecordId === anchorSourceRecordId);
    if (!anchorSourceRecordId || anchorSourceRecordId !== currentId || !anchorMember || anchorMember.url !== validCurrentUrl || anchorMember.sourceRecordHash !== currentHash || new Set(members.map(({ sourceRecordId }) => sourceRecordId)).size !== members.length) {
      fail("AESAN_INVALID_PUBLICATION_SELECTION", reference);
    }
    selection = {
      status: "parallel_publications",
      basis: "reviewed_shared_reference",
      chronological: false,
      anchorSourceRecordId,
      members
    };
  } else {
    selection = {
      status: "current_publication",
      basis: "feed_current",
      chronological: true,
      anchorSourceRecordId: currentId,
      members: [{ sourceRecordId: currentId, url: validCurrentUrl, sourceRecordHash: currentHash }]
    };
  }
  const evidence = {
    schemaVersion: 1,
    reference,
    selection,
    presentation: [],
    publications
  };
  evidence.presentation = presentationFor(evidence, selection.members, reference);
  if (bytes(evidence) > MAX_EVIDENCE_BYTES) fail("AESAN_PUBLICATION_LIMIT_EXCEEDED", reference);
  return evidence;
}
var parseStoredState = (value, reference) => {
  if (!value || typeof value !== "object") fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
  const item = value;
  const stateReference = text2(item.reference);
  const sourceRecordId = text2(item.sourceRecordId).toLowerCase();
  const url = officialAlertUrl(item.url);
  const publishedAt = isoDate2(item.publishedAt, true);
  const record7 = parseAesanPublishedRecord(item);
  if (!stateReference || !sourceRecordId || !url || publishedAt === void 0 || !record7 || !validIdentity(sourceRecordId, item.sourceRecordIdType, url)) {
    fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
  }
  const validRecord = record7;
  validateMaterialBounds(validRecord, reference);
  return {
    reference: stateReference,
    sourceRecordId,
    sourceRecordIdType: item.sourceRecordIdType,
    url,
    publishedAt,
    ...validRecord
  };
};
function parseAesanPublicationEvidence(value) {
  if (value === void 0 || value === null) return null;
  if (!value || typeof value !== "object" || bytes(value) > MAX_EVIDENCE_BYTES) {
    fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", null);
  }
  const raw = value;
  const reference = text2(raw.reference);
  if (raw.schemaVersion !== 1 || !reference || !raw.selection || typeof raw.selection !== "object" || !Array.isArray(raw.publications) || !raw.publications.length || raw.publications.length > MAX_PUBLICATIONS) {
    fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
  }
  const rawPublications = raw.publications;
  const publications = rawPublications.map((entry) => {
    if (!entry || typeof entry !== "object") fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
    const item = entry;
    const sourceRecordId = text2(item.sourceRecordId).toLowerCase();
    const url = officialAlertUrl(item.url);
    const anchor = text2(item.anchor);
    if (!sourceRecordId || !url || anchor !== aesanPublicationAnchor(sourceRecordId) || !Array.isArray(item.states) || !item.states.length || item.states.length > MAX_STATES_PER_PUBLICATION) {
      fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
    }
    const rawStates = item.states;
    const states = rawStates.map((state) => parseStoredState(state, reference));
    if (states.some((state) => state.sourceRecordId !== sourceRecordId || state.url !== url || state.sourceRecordIdType !== item.sourceRecordIdType) || new Set(states.map(({ sourceRecordHash }) => sourceRecordHash)).size !== states.length) {
      fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
    }
    return {
      sourceRecordId,
      sourceRecordIdType: item.sourceRecordIdType,
      url,
      anchor,
      states
    };
  });
  const publicationIds = publications.map(({ sourceRecordId }) => sourceRecordId);
  const publicationUrls = publications.map(({ url }) => url);
  const publicationAnchors = publications.map(({ anchor }) => anchor);
  const storedStateCount = publications.reduce((count, publication) => count + publication.states.length, 0);
  if (new Set(publicationIds).size !== publications.length || new Set(publicationUrls).size !== publications.length || new Set(publicationAnchors).size !== publications.length || storedStateCount > MAX_HISTORY_STATES) {
    fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
  }
  validateIdentities(publications.flatMap(({ states }) => states), reference);
  const selectionRaw = raw.selection;
  const status = selectionRaw.status;
  const basis = selectionRaw.basis;
  const chronological = selectionRaw.chronological;
  const anchorSourceRecordId = text2(selectionRaw.anchorSourceRecordId).toLowerCase();
  if (status !== "current_publication" && status !== "parallel_publications" || basis !== "feed_current" && basis !== "reviewed_shared_reference" || typeof chronological !== "boolean" || !anchorSourceRecordId || !Array.isArray(selectionRaw.members) || !selectionRaw.members.length || selectionRaw.members.length > MAX_PUBLICATIONS) {
    fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
  }
  const rawMembers = selectionRaw.members;
  const members = rawMembers.map((entry) => {
    if (!entry || typeof entry !== "object") fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
    const item = entry;
    const sourceRecordId = text2(item.sourceRecordId).toLowerCase();
    const url = officialAlertUrl(item.url);
    const sourceRecordHash = text2(item.sourceRecordHash).toLowerCase();
    if (!sourceRecordId || !url || !HASH_PATTERN.test(sourceRecordHash)) fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
    return { sourceRecordId, url, sourceRecordHash };
  });
  const currentSelection = status === "current_publication" && basis === "feed_current" && chronological === true && members.length === 1 && members[0]?.sourceRecordId === anchorSourceRecordId;
  const parallelSelection = status === "parallel_publications" && basis === "reviewed_shared_reference" && chronological === false && members.length >= 2;
  if (!currentSelection && !parallelSelection || !members.some(({ sourceRecordId }) => sourceRecordId === anchorSourceRecordId) || new Set(members.map(({ sourceRecordId }) => sourceRecordId)).size !== members.length) {
    fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
  }
  const evidence = {
    schemaVersion: 1,
    reference,
    selection: {
      status,
      basis,
      chronological,
      anchorSourceRecordId,
      members
    },
    presentation: [],
    publications
  };
  evidence.presentation = presentationFor(evidence, members, reference);
  if (!Array.isArray(raw.presentation) || !sameJson(raw.presentation, evidence.presentation)) {
    fail("AESAN_INVALID_STORED_PUBLICATION_EVIDENCE", reference);
  }
  return evidence;
}
function createAesanPublicationEvidenceFromMaterial(value) {
  const state = parseStoredState(value, value.reference);
  const publication = {
    sourceRecordId: state.sourceRecordId,
    sourceRecordIdType: state.sourceRecordIdType,
    url: state.url,
    anchor: aesanPublicationAnchor(state.sourceRecordId),
    states: [state]
  };
  const member = {
    sourceRecordId: state.sourceRecordId,
    url: state.url,
    sourceRecordHash: state.sourceRecordHash
  };
  const evidence = {
    schemaVersion: 1,
    reference: state.reference,
    selection: {
      status: "current_publication",
      basis: "feed_current",
      chronological: true,
      anchorSourceRecordId: state.sourceRecordId,
      members: [member]
    },
    presentation: [],
    publications: [publication]
  };
  evidence.presentation = presentationFor(evidence, [member], state.reference);
  return parseAesanPublicationEvidence(evidence);
}
function selectAesanPublicationEvidence(evidence, selection) {
  const selected = { ...evidence, selection, presentation: [] };
  selected.presentation = presentationFor(selected, selection.members, evidence.reference);
  return parseAesanPublicationEvidence(selected);
}
var aesanPublicationEvidence = (canonical) => canonical?.identity?.source === "AESAN" ? parseAesanPublicationEvidence(canonical.sourceRecord?.aesanPublicationEvidence) : null;
function mergeAesanPublicationEvidence(preferred, additional) {
  if (!preferred) return additional;
  if (!additional) return preferred;
  const reference = preferred.reference;
  const publications = preferred.publications.map((publication) => ({ ...publication, states: [...publication.states] }));
  for (const incoming of additional.publications) {
    const sameIdentity = publications.find(({ sourceRecordId }) => sourceRecordId === incoming.sourceRecordId);
    const samePath = publications.find(({ url }) => url === incoming.url);
    if (sameIdentity && sameIdentity.url !== incoming.url || samePath && samePath.sourceRecordId !== incoming.sourceRecordId) {
      fail("AESAN_PUBLICATION_IDENTITY_CONFLICT", reference);
    }
    const target = sameIdentity ?? (() => {
      const created = { ...incoming, states: [] };
      publications.push(created);
      return created;
    })();
    for (const state of incoming.states) if (!target.states.some(({ sourceRecordHash }) => sourceRecordHash === state.sourceRecordHash)) {
      target.states.push(state);
    }
    target.states.sort((left, right) => {
      if (left.publishedAt && right.publishedAt && left.publishedAt !== right.publishedAt) {
        return left.publishedAt.localeCompare(right.publishedAt);
      }
      return 0;
    });
  }
  const merged = { ...preferred, publications, presentation: [] };
  merged.presentation = presentationFor(merged, preferred.selection.members, reference);
  return parseAesanPublicationEvidence(merged);
}

// candidate-probe-v4-src/lib/aesan-taxonomy.ts
var AESAN_ALERT_TYPES = {
  general_population: { sourceTypeId: "b5c27f12-7f21-4d2e-bc5c-d5186b4d6259", officialLabel: "Alertas alimentarias de inter\xE9s para toda la poblaci\xF3n" },
  allergy_intolerance_adverse: { sourceTypeId: "8c7503b4-b714-4c08-9d8e-0039a2d03624", officialLabel: "Alertas alimentarias para personas con alergias, intolerancias u otros efectos adversos a determinadas sustancias" },
  food_supplements: { sourceTypeId: "649ce619-367b-4ad2-96cd-27b905fb6020", officialLabel: "Alertas alimentarias para personas que consumen complementos alimenticios" }
};
var AESAN_ALERT_TYPE_CODES = Object.keys(AESAN_ALERT_TYPES);
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
var MAX_PUBLICATIONS2 = 32;
var MAX_BYTES = 32768;
var fail2 = () => {
  throw new Error("AESAN_INVALID_ALERT_CLASSIFICATION");
};
var record4 = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : fail2();
var keys = (value, expected) => {
  if (Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) fail2();
};
var identity = (value) => {
  const item = record4(value);
  const { sourceRecordId, sourceRecordIdType, url } = item;
  if (typeof sourceRecordId !== "string" || typeof url !== "string" || url.length > 2048 || !isOfficialAesanAlertUrl(url) || new URL(url).href !== url || new URL(url).search || new URL(url).hash || new URL(url).username || new URL(url).password || !(sourceRecordIdType === "idAlert" && UUID.test(sourceRecordId) || sourceRecordIdType === "official_page_path" && sourceRecordId === `official_page_path:${new URL(url).pathname.replace(/\/+$/u, "")}`)) fail2();
  return { sourceRecordId, sourceRecordIdType, url };
};
var tuple = (value) => {
  const match = record4(value);
  keys(match, ["code", "sourceTypeId", "officialLabel"]);
  const code = match.code;
  if (typeof code !== "string" || !Object.hasOwn(AESAN_ALERT_TYPES, code)) fail2();
  const exact = AESAN_ALERT_TYPES[code];
  if (match.sourceTypeId !== exact.sourceTypeId || match.officialLabel !== exact.officialLabel) fail2();
  return { code, ...exact };
};
var ordered2 = (left, right) => left.url < right.url ? -1 : left.url > right.url ? 1 : left.sourceRecordId < right.sourceRecordId ? -1 : left.sourceRecordId > right.sourceRecordId ? 1 : 0;
function parseAesanAlertClassification(value, expected, evidence = null) {
  const root = record4(value);
  keys(root, ["schemaVersion", "status", "code", "sourceTypeId", "officialLabel", "publications"]);
  if (root.schemaVersion !== 1 || !["known", "unknown", "conflict"].includes(root.status) || !Array.isArray(root.publications) || root.publications.length < 1 || root.publications.length > MAX_PUBLICATIONS2 || JSON.stringify(value).length > MAX_BYTES) fail2();
  const publications = root.publications.map((raw) => {
    const item = record4(raw);
    keys(item, ["sourceRecordId", "sourceRecordIdType", "url", "matches"]);
    const base = identity(item);
    if (!Array.isArray(item.matches) || item.matches.length > AESAN_ALERT_TYPE_CODES.length) fail2();
    const matches = item.matches.map(tuple);
    if (new Set(matches.map(({ code }) => code)).size !== matches.length || matches.some((match, index2) => index2 > 0 && matches[index2 - 1].code >= match.code)) fail2();
    return { ...base, matches };
  });
  const ids = /* @__PURE__ */ new Set();
  const urls = /* @__PURE__ */ new Set();
  for (let index2 = 0; index2 < publications.length; index2 += 1) {
    const publication = publications[index2];
    if (ids.has(publication.sourceRecordId) || urls.has(publication.url) || index2 > 0 && ordered2(publications[index2 - 1], publication) >= 0) fail2();
    ids.add(publication.sourceRecordId);
    urls.add(publication.url);
  }
  const expectedIdentities = evidence ? evidence.publications : expected;
  if (expectedIdentities.length !== publications.length || expectedIdentities.some(({ sourceRecordId, sourceRecordIdType, url }) => !publications.some((publication) => publication.sourceRecordId === sourceRecordId && publication.sourceRecordIdType === sourceRecordIdType && publication.url === url))) fail2();
  const known = publications.flatMap(({ matches }) => matches);
  const conflict = publications.some(({ matches }) => matches.length > 1) || new Set(known.map(({ code }) => code)).size > 1;
  const status = conflict ? "conflict" : publications.some(({ matches }) => matches.length === 0) ? "unknown" : "known";
  if (root.status !== status) fail2();
  if (status === "known") {
    const exact = known[0];
    if (!exact || root.code !== exact.code || root.sourceTypeId !== exact.sourceTypeId || root.officialLabel !== exact.officialLabel) fail2();
  } else if (root.code !== null || root.sourceTypeId !== null || root.officialLabel !== null) fail2();
  return {
    schemaVersion: 1,
    status,
    code: status === "known" ? known[0].code : null,
    sourceTypeId: status === "known" ? known[0].sourceTypeId : null,
    officialLabel: status === "known" ? known[0].officialLabel : null,
    publications
  };
}

// candidate-probe-v4-src/lib/aesan.ts
var AESAN_FEED_URL = process.env.AESAN_FEED_URL ?? "https://raw.githubusercontent.com/cgam-coder/vigia-aesan-feed/main/feed.json";
var MAX_ARCHIVE_ALERTS = 5e3;
var ALLOWED_PRIORITIES = /* @__PURE__ */ new Set(["Cr\xEDtica", "Alta", "Media"]);
var UUID_PATTERN2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
var stableIdentity = (item, url) => {
  const pagePath = new URL(url).pathname.replace(/\/+$/u, "") || "/";
  const provided = text3(item.sourceRecordId);
  if (!provided) return { sourceRecordId: `official_page_path:${pagePath}`, sourceRecordIdType: "official_page_path" };
  if (item.sourceRecordIdType === "idAlert" && UUID_PATTERN2.test(provided)) {
    return { sourceRecordId: provided.toLowerCase(), sourceRecordIdType: "idAlert" };
  }
  if (item.sourceRecordIdType === "official_page_path" && provided === `official_page_path:${pagePath}`) {
    return { sourceRecordId: provided, sourceRecordIdType: "official_page_path" };
  }
  return null;
};
var validDate = (value, nullable = false) => {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) return void 0;
  return new Date(value).toISOString();
};
var officialAesanUrl = (value, image = false) => {
  if (value === null && image) return null;
  if (typeof value !== "string") return void 0;
  try {
    const url = new URL(value);
    const officialHost = url.hostname === "aesan.gob.es" || url.hostname.endsWith(".aesan.gob.es");
    if (url.protocol !== "https:" || !officialHost) return void 0;
    if (!image && !isOfficialAesanAlertUrl(value)) return void 0;
    return url.toString();
  } catch {
    return void 0;
  }
};
var text3 = (value, fallback = "") => typeof value === "string" ? value.trim() || fallback : fallback;
var previousReferences = (value, current) => Array.isArray(value) ? [...new Set(value.filter((entry) => typeof entry === "string").map((entry) => entry.trim()).filter((entry) => entry && entry !== current))].sort() : [];
var referenceHistory = (value, current) => Array.isArray(value) ? [...new Map(value.flatMap((entry) => {
  if (!entry || typeof entry !== "object") return [];
  const candidate = entry;
  const reference = text3(candidate.reference);
  const title = text3(candidate.title);
  const contentHash = text3(candidate.contentHash);
  return reference && reference !== current && title && /^[0-9a-f]{64}$/iu.test(contentHash) ? [[reference, { reference, title, contentHash: contentHash.toLowerCase() }]] : [];
})).values()].sort((left, right) => left.reference.localeCompare(right.reference, "en")) : [];
var operatorRole = (value) => {
  const role = value.toLocaleLowerCase("es");
  if (role.includes("fabricante")) return "manufacturer";
  if (role.includes("proveedor")) return "supplier";
  if (role.includes("distribuidor")) return "distributor";
  if (role.includes("importador")) return "importer";
  return "other";
};
async function normalizeAesanFeedAlert(value) {
  if (!value || typeof value !== "object") return null;
  const item = value;
  const reference = text3(item.reference);
  const title = text3(item.title);
  const url = officialAesanUrl(item.url);
  const publishedAt = validDate(item.publishedAt, true);
  const detectedAt = validDate(item.detectedAt);
  const updatedAt = validDate(item.updatedAt);
  if (!reference || !title || !url || publishedAt === void 0 || !detectedAt || !updatedAt) return null;
  if (item.source !== "AESAN" || item.type !== "Alimentaria" || !ALLOWED_PRIORITIES.has(item.priority)) return null;
  const lots = Array.isArray(item.lots) ? item.lots.filter((lot) => typeof lot === "string" && Boolean(lot.trim())).map((lot) => lot.trim()).slice(0, 20) : [];
  const imageUrl = officialAesanUrl(item.imageUrl, true);
  if (imageUrl === void 0) return null;
  const product = text3(item.product, "Consultar ficha oficial");
  const brand = text3(item.brand);
  const productClass = text3(item.productClass, "Otros alimentos");
  const productKey = text3(item.productKey);
  const brandKey = text3(item.brandKey);
  const provider = text3(item.provider);
  const providerKey = text3(item.providerKey);
  const providerRole = text3(item.providerRole);
  const providerEvidence = text3(item.providerEvidence);
  const identity2 = stableIdentity(item, url);
  if (!identity2) return null;
  const publishedRecord = parseAesanPublishedRecord(item);
  if (item.sourceRecordSchemaVersion === 2 && (!publishedRecord || publishedRecord.officialTitle !== title)) return null;
  const publicationEvidence = await buildAesanPublicationEvidence(item);
  const classification = Object.hasOwn(item, "aesanAlertClassification") ? parseAesanAlertClassification(
    item.aesanAlertClassification,
    [{ ...identity2, url }],
    publicationEvidence
  ) : null;
  const providedId = text3(item.id);
  const id = /^aesan:[^\s]{1,200}$/u.test(providedId) ? providedId : sourceScopedId("AESAN", reference);
  const seed = { source: "AESAN", sourceRecordId: identity2.sourceRecordId, officialUrl: url };
  const productValue = textValue(item.product, product, seed, "product");
  const categoryValue = textValue(item.productClass, productClass, seed, "productClass");
  const brandValue = textValue(item.brand, brand, seed, "brand");
  const providerValue = textValue(item.provider, provider, seed, "provider");
  const hazardValue = text3(item.hazard).startsWith("Consultar") ? missingValue() : textValue(item.hazard, text3(item.hazard), seed, "hazard");
  const originValue = text3(item.origin).startsWith("No indicado") ? missingValue() : textValue(item.origin, text3(item.origin), seed, "origin");
  const scopeValue = text3(item.scope).startsWith("Consultar") ? missingValue() : textValue(item.scope, text3(item.scope), seed, "scope");
  const actionValue = text3(item.action).startsWith("Consultar") ? missingValue() : textValue(item.action, text3(item.action), seed, "action");
  const canonical = {
    identity: { internalId: id, source: "AESAN", sourceRecordId: identity2.sourceRecordId, officialReference: reference, officialUrl: url },
    headline: knownValue(String(item.title), title, seed, "title"),
    dates: {
      publishedAt: publishedAt ? knownValue(String(item.publishedAt), publishedAt, seed, "publishedAt") : missingValue(),
      detectedAt,
      officialUpdatedAt: knownValue(String(item.updatedAt), updatedAt, seed, "updatedAt")
    },
    lifecycle: { officialUpdate: derivedValue(Boolean(item.isUpdate), seed, "is-update") },
    product: {
      name: productValue,
      category: categoryValue,
      domain: "Alimentaria",
      model: missingValue(),
      commercialReference: missingValue(),
      lots: lots.length ? knownValue(lots, lots, seed, "lots") : missingValue(),
      identifiers: []
    },
    operators: [
      ...brandValue.status === "known" ? [{ role: "brand", name: brandValue, evidence: null }] : [],
      ...providerValue.status === "known" && providerRole && providerEvidence ? [{ role: operatorRole(providerRole), name: providerValue, evidence: providerEvidence }] : []
    ],
    geography: {
      originCountry: originValue,
      notifyingCountry: missingValue(),
      affectedTerritories: missingValue(),
      distribution: scopeValue
    },
    risk: {
      type: hazardValue.status === "known" && hazardValue.normalized ? knownValue([String(item.hazard)], [hazardValue.normalized], seed, "hazard") : missingValue(),
      hazard: hazardValue,
      description: missingValue(),
      reason: missingValue(),
      measures: missingValue(),
      recommendations: actionValue,
      priority: derivedValue(item.priority, seed, "priority")
    },
    resources: [
      { kind: "official_page", url, label: "Fuente oficial" },
      ...imageUrl ? [{ kind: "image", url: imageUrl, label: null }] : []
    ],
    sourceRecord: {
      sourceRecordId: identity2.sourceRecordId,
      sourceRecordIdType: identity2.sourceRecordIdType,
      previousReferences: previousReferences(item.previousReferences, reference),
      referenceHistory: referenceHistory(item.referenceHistory, reference),
      reference: item.reference ?? null,
      title: item.title ?? null,
      product: item.product ?? null,
      brand: item.brand ?? null,
      productClass: item.productClass ?? null,
      provider: item.provider ?? null,
      providerRole: item.providerRole ?? null,
      providerEvidence: item.providerEvidence ?? null,
      hazard: item.hazard ?? null,
      origin: item.origin ?? null,
      scope: item.scope ?? null,
      notifyingText: item.notifyingText ?? null,
      action: item.action ?? null,
      lots: item.lots ?? [],
      url: item.url ?? null,
      imageUrl: item.imageUrl ?? null,
      publishedAt: item.publishedAt ?? null,
      ...publishedRecord ?? {},
      ...publicationEvidence ? { aesanPublicationEvidence: publicationEvidence } : {},
      ...classification ? { aesanAlertClassification: classification } : {}
    }
  };
  const hashCanonical = JSON.parse(JSON.stringify(canonical, (key, child) => key === "sourceRecordId" ? reference : child));
  hashCanonical.identity.internalId = sourceScopedId("AESAN", reference);
  const canonicalHash = await canonicalContentHash(hashCanonical);
  const contentHash = publishedRecord ? await (async () => {
    const bytes2 = new TextEncoder().encode(JSON.stringify({ canonicalHash, sourceRecordHash: publishedRecord.sourceRecordHash }));
    const digest2 = await crypto.subtle.digest("SHA-256", bytes2);
    return [...new Uint8Array(digest2)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  })() : canonicalHash;
  return {
    id,
    reference,
    source: "AESAN",
    type: "Alimentaria",
    priority: item.priority,
    title,
    product,
    brand,
    productClass,
    productKey,
    brandKey,
    provider,
    providerKey,
    providerRole,
    providerEvidence,
    hazard: text3(item.hazard, "Consultar publicaci\xF3n oficial"),
    origin: text3(item.origin, "No indicado"),
    scope: text3(item.scope, "Consultar alcance en la ficha oficial de AESAN"),
    action: text3(item.action, "Consultar las medidas y recomendaciones incluidas en la ficha oficial de AESAN."),
    lots,
    imageUrl,
    url,
    publishedAt,
    detectedAt,
    updatedAt,
    contentHash,
    versionCount: Number.isInteger(item.versionCount) && Number(item.versionCount) > 0 ? Number(item.versionCount) : 1,
    isUpdate: Boolean(item.isUpdate),
    canonical
  };
}
async function fetchAesanAlerts() {
  const response = await fetch(AESAN_FEED_URL, {
    headers: { Accept: "application/json", "User-Agent": "VIGIA-Alerts/0.4 (direct-aesan-feed)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) throw new Error(`El conector directo de AESAN respondi\xF3 con estado ${response.status}`);
  const payload = await response.json();
  if (payload.schemaVersion !== 1 || payload.source?.name !== "AESAN" || payload.source?.url !== AESAN_SEARCH_URL || !Array.isArray(payload.alerts)) {
    throw new Error("El conector directo de AESAN devolvi\xF3 un formato no verificable");
  }
  const normalized = await Promise.all(payload.alerts.slice(0, MAX_ARCHIVE_ALERTS).map(normalizeAesanFeedAlert));
  const alerts2 = normalized.filter((alert) => Boolean(alert));
  if (!alerts2.length) throw new Error("El conector directo de AESAN no contiene alertas verificables");
  return alerts2.sort((a, b) => (b.publishedAt ?? b.detectedAt).localeCompare(a.publishedAt ?? a.detectedAt));
}

// candidate-probe-v4-src/lib/aesan-producer/aesan.mjs
import { createHash } from "node:crypto";
var AESAN_ORIGIN = "https://www.aesan.gob.es";
var AESAN_LIST_URL = `${AESAN_ORIGIN}/alertas/buscador-alertas`;
var MONTHS = /* @__PURE__ */ new Map([
  ["enero", 0],
  ["febrero", 1],
  ["marzo", 2],
  ["abril", 3],
  ["mayo", 4],
  ["junio", 5],
  ["julio", 6],
  ["agosto", 7],
  ["septiembre", 8],
  ["setiembre", 8],
  ["octubre", 9],
  ["noviembre", 10],
  ["diciembre", 11]
]);
var NAMED_ENTITIES = /* @__PURE__ */ new Map([
  ["nbsp", " "],
  ["amp", "&"],
  ["quot", '"'],
  ["apos", "'"],
  ["lt", "<"],
  ["gt", ">"],
  ["aacute", "\xE1"],
  ["eacute", "\xE9"],
  ["iacute", "\xED"],
  ["oacute", "\xF3"],
  ["uacute", "\xFA"],
  ["ntilde", "\xF1"],
  ["Aacute", "\xC1"],
  ["Eacute", "\xC9"],
  ["Iacute", "\xCD"],
  ["Oacute", "\xD3"],
  ["Uacute", "\xDA"],
  ["Ntilde", "\xD1"],
  ["uuml", "\xFC"],
  ["Uuml", "\xDC"]
]);
function decodeEntities(value = "") {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return NAMED_ENTITIES.get(code) ?? entity;
  });
}
function stripHtml(value = "") {
  return decodeEntities(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(?:p|li|ul|ol|div|section|article|figure|h[1-6])\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();
}
var attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return decodeEntities(match?.[1] ?? match?.[2] ?? "").trim();
};
var absoluteOfficialUrl = (value) => {
  try {
    const url = new URL(value, AESAN_ORIGIN);
    if (url.hostname !== "aesan.gob.es" && !url.hostname.endsWith(".aesan.gob.es")) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
};
var openingTag = (block = "") => block.match(/^<[^>]+>/u)?.[0] ?? "";
var elementBlocks = (html, tagName) => {
  const blocks = [];
  const opening = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  for (const match of html.matchAll(opening)) {
    const token = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
    token.lastIndex = match.index;
    let depth = 0;
    let end = -1;
    for (let current = token.exec(html); current; current = token.exec(html)) {
      depth += current[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = token.lastIndex;
        break;
      }
    }
    if (end > match.index) blocks.push({ html: html.slice(match.index, end), index: match.index });
  }
  return blocks;
};
var classNames = (tag) => new Set(attribute(tag, "class").split(/\s+/u).filter(Boolean));
var materialArticleBody = (articleHtml) => {
  const candidates = elementBlocks(articleHtml, "div").filter(({ html }) => {
    const names = classNames(openingTag(html));
    return names.has("post-container") && !names.has("aesan-bgText");
  });
  return candidates.length ? candidates.map(({ html }) => html).join("\n") : articleHtml;
};
var exactFieldPair = (value) => {
  const text4 = stripHtml(value);
  const match = text4.match(/^([^:\n]{2,120})\s*:\s*([\s\S]+)$/u);
  return match ? { label: match[1].trim(), value: match[2].trim() } : null;
};
function extractPublishedFields(articleHtml) {
  const body = materialArticleBody(articleHtml);
  const fields = [];
  const lists = elementBlocks(body, "ul");
  for (let group = 0; group < lists.length; group += 1) {
    const pairs = elementBlocks(lists[group].html, "li").map(({ html }) => exactFieldPair(html)).filter(Boolean);
    if (!pairs.length) continue;
    for (let position = 0; position < pairs.length; position += 1) {
      fields.push({
        ...pairs[position],
        sourceField: `article.productData[${group}].field[${position}]`,
        order: fields.length,
        section: "product_data",
        context: `list:${group}`
      });
    }
  }
  return fields;
}
var normalizedComparableText = (value) => stripHtml(value).replace(/[\s“”'".,;:()\[\]]+/gu, "").toLocaleLowerCase("es");
function extractMaterialParagraphs(articleHtml) {
  const body = materialArticleBody(articleHtml);
  const paragraphs = [];
  const listItemRanges = elementBlocks(body, "li").map(({ html, index: index2 }) => ({ start: index2, end: index2 + html.length }));
  for (const { html, index: index2 } of elementBlocks(body, "p")) {
    if (listItemRanges.some(({ start, end }) => index2 > start && index2 < end)) continue;
    const value = stripHtml(html);
    if (!value || /^Los datos de(?:l| los) productos? implicados? son\s*:?$/iu.test(value) || /^Se adjunta(?:n)? (?:una |las )?im[aá]gen(?:es)? disponible(?:s)?\.?$/iu.test(value) || /^Fecha y hora\s*:/iu.test(value)) continue;
    const links = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => stripHtml(match[1])).filter(Boolean);
    if (links.length && normalizedComparableText(value) === normalizedComparableText(links.join(" "))) continue;
    paragraphs.push({ value, sourceField: `article.body.p[${paragraphs.length}]`, order: paragraphs.length, section: "publication" });
  }
  return paragraphs;
}
function extractOfficialResources(articleHtml, officialUrl2) {
  const body = materialArticleBody(articleHtml);
  const resources = [];
  const seen = /* @__PURE__ */ new Set();
  const append = (resource) => {
    if (!resource.url || seen.has(resource.url)) return;
    seen.add(resource.url);
    resources.push({ ...resource, order: resources.length });
  };
  for (const match of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const url = absoluteOfficialUrl(attribute(tag, "src"));
    if (!url || !/\/dam\/jcr:/iu.test(new URL(url).pathname)) continue;
    append({ kind: "image", url, label: attribute(tag, "alt") || null, sourceField: `article.image[${resources.length}]` });
  }
  for (const { html } of elementBlocks(body, "a")) {
    const tag = openingTag(html);
    const url = absoluteOfficialUrl(attribute(tag, "href"));
    const label = stripHtml(html);
    if (!url || url === officialUrl2 || /\/alertas\/buscador-alertas\/?$/iu.test(new URL(url).pathname) || !label) continue;
    append({
      kind: /\.pdf(?:$|[?#])/iu.test(url) ? "document" : "link",
      url,
      label,
      sourceField: `article.link[${resources.length}]`
    });
  }
  return resources;
}
function extractOfficialDates(html, articleHtml) {
  const dates = [];
  const pageInfo = elementBlocks(articleHtml, "div").find(({ html: block }) => classNames(openingTag(block)).has("pageInfo__date"));
  const pageDate = stripHtml(pageInfo?.html ?? "").match(/\b\d{2}\/\d{2}\/20\d{2}\b/u)?.[0] ?? "";
  if (pageDate) dates.push({ label: null, value: pageDate, sourceField: "pageInfo.date", order: dates.length });
  const body = materialArticleBody(articleHtml);
  for (const { html: block } of elementBlocks(body, "p")) {
    const value = stripHtml(block);
    const match = value.match(/^(Fecha y hora)\s*:\s*([\s\S]+)$/iu);
    if (!match) continue;
    const candidate = { label: match[1], value: match[2].trim(), sourceField: `article.date[${dates.length}]`, order: dates.length };
    if (!dates.some((date) => date.label === candidate.label && date.value === candidate.value)) dates.push(candidate);
  }
  return dates;
}
var UUID_PATTERN3 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var officialPagePath = (value) => {
  const url = absoluteOfficialUrl(value);
  return url ? new URL(url).pathname.replace(/\/+$/u, "") || "/" : null;
};
function sourceIdentityForHtml(html, officialUrl2) {
  const tag = html.match(/<meta\b[^>]*\bname\s*=\s*["']idAlert["'][^>]*>/i)?.[0] ?? "";
  const idAlert = attribute(tag, "content");
  const pagePath = officialPagePath(officialUrl2);
  if (!pagePath) throw new Error(`URL oficial AESAN no v\xE1lida para identidad: ${officialUrl2}`);
  if (idAlert) {
    if (!UUID_PATTERN3.test(idAlert)) throw new Error(`idAlert AESAN no v\xE1lido en ${pagePath}`);
    return { sourceRecordId: idAlert.toLowerCase(), sourceRecordIdType: "idAlert", officialPagePath: pagePath };
  }
  return {
    sourceRecordId: `official_page_path:${pagePath}`,
    sourceRecordIdType: "official_page_path",
    officialPagePath: pagePath
  };
}
var identityForAlert = (alert) => {
  const pagePath = officialPagePath(alert.url);
  if (!pagePath) throw new Error(`Alerta AESAN con URL oficial no v\xE1lida: ${alert.url}`);
  const sourceRecordId = typeof alert.sourceRecordId === "string" && alert.sourceRecordId.trim() ? alert.sourceRecordId.trim() : `official_page_path:${pagePath}`;
  const sourceRecordIdType = alert.sourceRecordIdType === "idAlert" ? "idAlert" : "official_page_path";
  return { sourceRecordId, sourceRecordIdType, officialPagePath: pagePath };
};
var historyEntry = (alert) => ({
  reference: alert.reference,
  title: alert.title,
  contentHash: alert.contentHash
});
var normalizedReferenceHistory = (entries, current = null) => {
  const unique = /* @__PURE__ */ new Map();
  for (const entry of entries ?? []) {
    if (!entry || typeof entry.reference !== "string" || typeof entry.title !== "string" || typeof entry.contentHash !== "string" || !entry.reference || !entry.title || !entry.contentHash) continue;
    const key = `${entry.reference}\0${entry.contentHash}`;
    if (current && entry.reference === current.reference && entry.contentHash === current.contentHash) continue;
    if (!unique.has(key)) unique.set(key, {
      reference: entry.reference,
      title: entry.title,
      contentHash: entry.contentHash
    });
  }
  return [...unique.values()];
};
var previousReferencesFor2 = (history, currentReference) => [...new Set(history.map((entry) => entry.reference).filter((reference) => reference && reference !== currentReference))];
function isOfficialAesanAlertUrl2(value) {
  const url = absoluteOfficialUrl(value);
  if (!url) return false;
  const path = new URL(url).pathname;
  return /^\/alertas\/(?!buscador-alertas(?:\/|$)|alertas-alimentarias(?:\/|$))[^/?#]+/i.test(path) || /^\/AECOSAN\/web\/seguridad_alimentaria\/(?:alertas_alimentarias|ampliacion)\/(?!listado\/)[^/?#]+\.htm$/i.test(path);
}
var normalizeReference = (value = "") => {
  const match = value.match(/ES\s*(20\d{2})\s*[/.\-]\s*(\d+)/i);
  return match ? `ES${match[1]}/${match[2]}` : "";
};
function parseSpanishDate(value = "") {
  const match = stripHtml(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").match(/\b(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/i);
  if (!match) return null;
  const month = MONTHS.get(match[2].toLowerCase());
  if (month === void 0) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1]), 12)).toISOString();
}
var categoryFor2 = (title, icon = "", body = "") => {
  const value = `${icon} ${title} ${body}`.toLowerCase();
  if (/\bpill\b|complementos? alimenticios?|sildenafilo|tadalafilo/.test(value)) return "supplements";
  if (/\bcookie\b|advertencia|alerg|intoler|no declarad|etiquetado incorrecto/.test(value)) return "allergens";
  return "general";
};
function parseListCards(html) {
  const cards = /* @__PURE__ */ new Map();
  const pattern = /<a\b([^>]*\bclass\s*=\s*(?:\"[^\"]*\bseeMoreCard\b[^\"]*\"|'[^']*\bseeMoreCard\b[^']*')[^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = absoluteOfficialUrl(attribute(match[1], "href"));
    if (!href || !isOfficialAesanAlertUrl2(href)) continue;
    const title = attribute(match[1], "title") || stripHtml(match[2].match(/<p\b[^>]*\bseeMoreCard__text\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (!title) continue;
    const dateText = stripHtml(match[2].match(/<[^>]*\bseeMoreCard-heading__value\b[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const icon = stripHtml(match[2].match(/<[^>]*\bseeMoreCard-heading__icon\b[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const reference = normalizeReference(title);
    cards.set(href, { url: href, title, reference, publishedAt: parseSpanishDate(dateText), category: categoryFor2(title, icon) });
  }
  return [...cards.values()];
}
var fieldMap = (articleHtml) => {
  const fields = /* @__PURE__ */ new Map();
  for (const item of articleHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text4 = stripHtml(item[1]);
    const match = text4.match(/^([^:\n]{2,90})\s*:\s*([\s\S]+)$/);
    if (match) fields.set(match[1].toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""), match[2].trim().replace(/[.;]+$/, ""));
  }
  return fields;
};
var findFieldEntry = (fields, labels) => {
  for (const [label, value] of fields) {
    if (labels.some((candidate) => label === candidate || label.startsWith(`${candidate} `))) return { label, value };
  }
  return null;
};
var findField = (fields, labels) => findFieldEntry(fields, labels)?.value ?? "";
var normalizeEntityKey2 = (value = "") => stripHtml(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\b(?:s\.?l\.?u?|s\.?a\.?u?|s\.?c\.?|sociedad limitada|sociedad anonima)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
var productClassFor = (product = "", title = "", alertCategory = "") => {
  const normalized = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const productValue = normalized(product);
  const titleValue = normalized(title);
  const classes = [
    ["Complementos alimenticios", /complemento alimenticio|suplemento|capsul|comprimido|extracto|vitamin|minerales?/],
    ["Carne y productos c\xE1rnicos", /carne|carnic|salchich|choriz|fuet|jamon|lomo embuchado|mortadela|hamburgues|pollo|pavo|cerdo|vacuno/],
    ["Pescado y marisco", /pescad|marisc|bacalao|salmon|atun|anchoa|langost|gamba|camaron|mejillon|almeja|calamar|pulpo|necora/],
    ["Leche y productos l\xE1cteos", /\bleche\b|lacte|queso|yogur|nata|mantequilla|helado/],
    ["Platos preparados y sopas", /plato preparado|precocinado|sopa|pizza|lasana|tortilla|croqueta|kit ramen/],
    ["Cereales, panader\xEDa y pasta", /harina|pan\b|bolleri|galleta|cereal|pasta|fideo|ramen|trigo|centeno|avena|arroz|maiz/],
    ["Bebidas", /bebida|zumo|jugo|cerveza|vino|licor|refresco|infusion|te\b|cafe/],
    ["Frutas y hortalizas", /fruta|hortaliza|verdura|lechuga|espinaca|tomate|patata|seta|manzana|moringa|brotes? germinad/],
    ["Frutos secos y semillas", /fruto seco|almendra|avellana|nuez|pistacho|cacahuete|sesamo|semilla/],
    ["Dulces y confiter\xEDa", /chocolate|cacao|caramelo|golosina|confiteria|dulce|postre|crema de cacao/],
    ["Condimentos, salsas y especias", /especia|condimento|salsa|canela|pimenton|curcuma|mostaza|mayonesa/],
    ["Aceites y grasas", /aceite|grasa vegetal|margarina/]
  ];
  return classes.find(([, pattern]) => pattern.test(productValue))?.[0] || classes.find(([, pattern]) => pattern.test(titleValue))?.[0] || (alertCategory === "supplements" ? "Complementos alimenticios" : "Otros alimentos");
};
var providerFor = (fields) => {
  const groups = [
    { role: "Fabricante", labels: ["fabricante", "empresa fabricante"] },
    { role: "Distribuidor", labels: ["distribuidor", "empresa distribuidora"] },
    { role: "Importador", labels: ["importador", "empresa importadora"] },
    { role: "Comercializador", labels: ["comercializador", "empresa comercializadora"] },
    { role: "Operador alimentario", labels: ["operador alimentario", "operador", "empresa responsable", "nombre de la empresa", "empresa", "razon social"] }
  ];
  for (const group of groups) {
    const entry = findFieldEntry(fields, group.labels);
    if (entry?.value) return { name: entry.value, role: group.role, evidence: `Campo oficial: ${entry.label}` };
  }
  return { name: "", role: "", evidence: "" };
};
var inferHazard = (text4) => {
  const value = text4.toLowerCase();
  const hazards = [
    ["salmonella", "Salmonella spp."],
    ["listeria", "Listeria monocytogenes"],
    ["escherichia coli", "E. coli"],
    ["stec", "E. coli STEC"],
    ["histamina", "Histamina"],
    ["cereulida", "Cereulida"],
    ["bacillus cereus", "Bacillus cereus"],
    ["toxina botul", "Toxina botul\xEDnica"],
    ["aflatox", "Aflatoxinas"],
    ["sildenafilo", "Sildenafilo"],
    ["tadalafilo", "Tadalafilo"],
    ["fragmentos de vidrio", "Fragmentos de vidrio"],
    ["part\xEDculas de aluminio", "Part\xEDculas de aluminio"],
    ["fragmentos de pl\xE1stico", "Fragmentos de pl\xE1stico"],
    ["fragmentos met\xE1licos", "Fragmentos met\xE1licos"],
    ["cuerpos extra\xF1os", "Cuerpos extra\xF1os"]
  ];
  let found = hazards.filter(([needle]) => value.includes(needle)).map(([, label]) => label);
  if (found.some((label) => label.startsWith("Fragmentos de ") || label.startsWith("Part\xEDculas de "))) {
    found = found.filter((label) => label !== "Cuerpos extra\xF1os");
  }
  if (/advertencia|alerg|intoler|no declarad|etiquetado incorrecto/.test(value)) {
    const allergens = [
      ["leche", "Leche no declarada"],
      ["lactosa", "Lactosa no declarada"],
      ["gluten", "Gluten no declarado"],
      ["almendra", "Almendra no declarada"],
      ["huevo", "Huevo no declarado"],
      ["soja", "Soja no declarada"],
      ["cacahuete", "Cacahuete no declarado"],
      ["s\xE9samo", "S\xE9samo no declarado"],
      ["pescado", "Pescado no declarado"],
      ["sulfit", "Sulfitos no declarados"],
      ["trigo", "Trigo no declarado"],
      ["frutos secos", "Frutos secos no declarados"]
    ];
    found.push(...allergens.filter(([needle]) => value.includes(needle)).map(([, label]) => label));
  }
  return [...new Set(found)].join(" \xB7 ") || "Consultar publicaci\xF3n oficial";
};
var inferPriority = (text4) => {
  const value = text4.toLowerCase();
  if (/brote|fallecid|hospitaliz|riesgo grave/.test(value)) return "Cr\xEDtica";
  if (/salmonella|listeria|escherichia|stec|toxina|cereulida|bacillus|aflatox|sildenafilo|tadalafilo|histamina|vidrio|aluminio|plástico|metal|cuerpos extraños/.test(value)) return "Alta";
  return "Media";
};
var titleProduct = (title) => title.match(/\ben\s+(.+?)(?:\s+procedente(?:s)?\s+de\b|\s*\(Ref\b|[.;]|$)/i)?.[1]?.replace(/^(?:el\s+)?etiquetado\s+(?:incorrecto\s+de\s+al[eé]rgeno\s+\([^)]*\)\s+)?/i, "").trim() ?? "Consultar ficha oficial";
var originFor = (title, fields) => findField(fields, ["pais de origen", "origen"]) || title.match(/procedente(?:s)?\s+de\s+(.+?)(?:\s*\(Ref\b|[.;]|$)/i)?.[1]?.trim() || "No indicado";
var sentences = (text4) => text4.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜ])/).map((line) => line.trim()).filter(Boolean);
var NOTIFYING_SENTENCE_PATTERNS = [
  /\bnotificaci[oó]n de alerta trasladada por las autoridades sanitarias(?:\s+de)?\s+/i,
  /\b(?:agencia española de seguridad alimentaria y nutrici[oó]n|AESAN)\b[\s\S]{0,180}\bha sido informada por\b/i,
  /\b(?:comunidad aut[oó]noma de|comunidad valenciana)\b[\s\S]{0,260}\bha(?:n)? informado a (?:la )?(?:agencia española de seguridad alimentaria y nutrici[oó]n|AESAN)\b/i,
  /\bautoridades (?:competentes|sanitarias) de\b[\s\S]{0,180}\bhan informado a (?:la )?(?:agencia española de seguridad alimentaria y nutrici[oó]n|AESAN)\b/i
];
var SPAIN_AUTONOMOUS_COMMUNITY_PATTERN = /(?:^|[^a-záéíóúüñ])(?:Andalucía|Aragón|Asturias|Illes Balears|Islas Baleares|Baleares|Canarias|Cantabria|Castilla y León|Castilla\s*(?:-\s*)?La Mancha|Cataluña|Catalunya|Ceuta|Melilla|Comunidad Valenciana|Comunitat Valenciana|Extremadura|Galicia|Madrid|Murcia|Navarra|País Vasco|Euskadi|La Rioja)(?=$|[^a-záéíóúüñ])/iu;
var notifyingTextFor = (articleText = "") => sentences(articleText).find((line) => /\bSCIRI\b/i.test(line) && SPAIN_AUTONOMOUS_COMMUNITY_PATTERN.test(line) && NOTIFYING_SENTENCE_PATTERNS.some((pattern) => pattern.test(line))) ?? "";
var scopeFor = (text4, category) => sentences(text4).find((line) => /distribuci[oó]n (?:inicial|del producto)|distribuido (?:inicialmente|en)|ha sido distribuido/i.test(line))?.slice(0, 360) || (category === "allergens" ? "Colectivo al\xE9rgico o intolerante indicado por AESAN" : category === "supplements" ? "Personas consumidoras del complemento alimenticio indicado" : "Poblaci\xF3n general \xB7 publicaci\xF3n oficial AESAN");
var actionFor = (text4) => sentences(text4).find((line) => /(?:como medida de precauci[oó]n,?\s+)?se recomienda|se abstengan de consumir|retirada de (?:los )?productos|\bno consumir\b/i.test(line))?.slice(0, 360) || "Consultar las medidas y recomendaciones incluidas en la ficha oficial de AESAN.";
var listLots = (value) => {
  if (!value) return [];
  if (/^todos? los lotes/i.test(value)) return [value];
  return value.split(/\s*[;,]\s*|\s+y\s+(?=[A-Z0-9])/).map((lot) => lot.trim()).filter(Boolean).slice(0, 20);
};
var digest = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
var articleFragment = (html) => {
  const start = html.search(/<h1\b[^>]*\baesan-title\b/i);
  if (start < 0) return html;
  const end = html.slice(start).search(/<a\b[^>]*href\s*=\s*["']\/alertas\/buscador-alertas["']/i);
  return end < 0 ? html.slice(start) : html.slice(start, start + end);
};
var contentDate = (html) => {
  const tag = html.match(/<meta\b[^>]*\bname\s*=\s*["']content-date["'][^>]*>/i)?.[0] ?? "";
  const value = attribute(tag, "content");
  return value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : null;
};
function parseDetail(html, card, previous = null, detectedAt = (/* @__PURE__ */ new Date()).toISOString(), suppliedIdentity = null) {
  const articleHtml = articleFragment(html);
  const articleText = stripHtml(articleHtml);
  const notifyingText = notifyingTextFor(articleText);
  const fields = fieldMap(articleHtml);
  const heading = stripHtml(articleHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const title = heading || card.title;
  const reference = normalizeReference(title) || card.reference || new URL(card.url).pathname.split("/").filter(Boolean).at(-1);
  const product = findField(fields, ["nombre del producto", "denominacion del producto", "producto"]) || titleProduct(title);
  const brand = findField(fields, ["marca", "nombre de marca", "marca comercial"]);
  const provider = providerFor(fields);
  const lotText = findField(fields, ["numero de lote", "n\xBA de lote", "n\xB0 de lote", "lote", "lotes"]);
  const category = categoryFor2(title, "", articleText);
  const productClass = productClassFor(product, title, category);
  const officialTitle = title;
  const publishedFields = extractPublishedFields(articleHtml);
  const materialParagraphs = extractMaterialParagraphs(articleHtml);
  const resources = extractOfficialResources(articleHtml, card.url);
  const officialDates = extractOfficialDates(html, articleHtml);
  const image = resources.find(({ kind }) => kind === "image")?.url ?? null;
  const publishedAt = contentDate(html) || card.publishedAt;
  const sourceRecordHash = digest({ officialTitle, publishedFields, materialParagraphs, resources, officialDates });
  const previousSourceRecordHash = typeof previous?.sourceRecordHash === "string" && /^[0-9a-f]{64}$/iu.test(previous.sourceRecordHash) ? previous.sourceRecordHash : null;
  const changed = Boolean(previous?.contentHash && previousSourceRecordHash && previousSourceRecordHash !== sourceRecordHash);
  const contentHash = changed ? sourceRecordHash : previous?.contentHash || sourceRecordHash;
  const identity2 = suppliedIdentity ?? sourceIdentityForHtml(html, card.url);
  const referenceHistory2 = normalizedReferenceHistory([
    ...previous?.referenceHistory ?? [],
    ...previous && changed ? [historyEntry(previous)] : []
  ], { reference, contentHash });
  const normalized = {
    id: previous?.id || `aesan:${reference}`,
    reference,
    sourceRecordId: identity2.sourceRecordId,
    sourceRecordIdType: identity2.sourceRecordIdType,
    sourceRecordSchemaVersion: 2,
    sourceRecordHash,
    previousReferences: previousReferencesFor2(referenceHistory2, reference),
    referenceHistory: referenceHistory2,
    source: "AESAN",
    type: "Alimentaria",
    priority: inferPriority(title),
    title,
    product,
    brand,
    productClass,
    productKey: normalizeEntityKey2(product),
    brandKey: normalizeEntityKey2(brand),
    provider: provider.name,
    providerKey: normalizeEntityKey2(provider.name),
    providerRole: provider.role,
    providerEvidence: provider.evidence,
    notifyingText,
    hazard: inferHazard(title),
    origin: originFor(title, fields),
    scope: scopeFor(articleText, category),
    action: actionFor(articleText),
    lots: listLots(lotText),
    imageUrl: image,
    officialTitle,
    publishedFields,
    materialParagraphs,
    resources,
    officialDates,
    url: card.url,
    publishedAt,
    detectedAt: previous?.detectedAt || detectedAt,
    updatedAt: changed ? detectedAt : previous?.updatedAt || publishedAt || detectedAt,
    contentHash,
    versionCount: changed ? (previous.versionCount || 1) + 1 : previous?.versionCount || 1,
    isUpdate: /ampliaci[oó]n|actualizaci[oó]n|correcci[oó]n/i.test(title)
  };
  return normalized;
}
function cardFallback(card, previous = null, detectedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  if (previous) return { ...previous, notifyingText: previous.notifyingText ?? "" };
  const contentHash = digest(card);
  const product = titleProduct(card.title);
  const pagePath = officialPagePath(card.url);
  return {
    id: `aesan:${card.reference || new URL(card.url).pathname.split("/").filter(Boolean).at(-1)}`,
    reference: card.reference || `AESAN/${new URL(card.url).pathname.split("/").filter(Boolean).at(-1)}`,
    sourceRecordId: `official_page_path:${pagePath}`,
    sourceRecordIdType: "official_page_path",
    sourceRecordSchemaVersion: 2,
    sourceRecordHash: contentHash,
    previousReferences: [],
    referenceHistory: [],
    source: "AESAN",
    type: "Alimentaria",
    priority: inferPriority(card.title),
    title: card.title,
    product,
    brand: "",
    productClass: productClassFor(product, card.title, card.category),
    productKey: normalizeEntityKey2(product),
    brandKey: "",
    provider: "",
    providerKey: "",
    providerRole: "",
    providerEvidence: "",
    notifyingText: "",
    hazard: inferHazard(card.title),
    origin: originFor(card.title, /* @__PURE__ */ new Map()),
    scope: card.category === "allergens" ? "Colectivo al\xE9rgico o intolerante indicado por AESAN" : "Poblaci\xF3n general \xB7 publicaci\xF3n oficial AESAN",
    action: "Consultar las medidas y recomendaciones incluidas en la ficha oficial de AESAN.",
    lots: [],
    imageUrl: null,
    officialTitle: card.title,
    publishedFields: [],
    materialParagraphs: [],
    resources: [],
    officialDates: [],
    url: card.url,
    publishedAt: card.publishedAt,
    detectedAt,
    updatedAt: card.publishedAt || detectedAt,
    contentHash,
    versionCount: 1,
    isUpdate: /ampliaci[oó]n|actualizaci[oó]n|correcci[oó]n/i.test(card.title)
  };
}
var feedSignature = (feed) => JSON.stringify({
  source: feed.source,
  archive: { ...feed.archive, lastFullSyncAt: null },
  alerts: feed.alerts
});
function assembleFeed(currentFeed, currentAlerts, now = (/* @__PURE__ */ new Date()).toISOString(), options = {}) {
  const identityPaths = /* @__PURE__ */ new Map();
  const pathIdentities = /* @__PURE__ */ new Map();
  const referenceIdentities = /* @__PURE__ */ new Map();
  for (const alert of currentAlerts) {
    const identity2 = identityForAlert(alert);
    const previousPath = identityPaths.get(identity2.sourceRecordId);
    if (previousPath && previousPath !== identity2.officialPagePath) {
      throw new Error(`Identidad AESAN ${identity2.sourceRecordId} presente en varias p\xE1ginas: ${previousPath}, ${identity2.officialPagePath}`);
    }
    identityPaths.set(identity2.sourceRecordId, identity2.officialPagePath);
    if (identity2.sourceRecordIdType === "idAlert") {
      const previousIdentity = pathIdentities.get(identity2.officialPagePath);
      if (previousIdentity && previousIdentity !== identity2.sourceRecordId) {
        throw new Error(`P\xE1gina AESAN ${identity2.officialPagePath} asociada a UUID incompatibles`);
      }
      pathIdentities.set(identity2.officialPagePath, identity2.sourceRecordId);
    }
    const previousReferenceIdentity = referenceIdentities.get(alert.reference);
    if (previousReferenceIdentity && previousReferenceIdentity !== identity2.sourceRecordId) {
      throw new Error(`Referencia AESAN ${alert.reference} asociada a identidades distintas`);
    }
    referenceIdentities.set(alert.reference, identity2.sourceRecordId);
  }
  const unique = /* @__PURE__ */ new Map();
  const alertOrder = (a, b) => (b.publishedAt || b.detectedAt || "").localeCompare(a.publishedAt || a.detectedAt || "") || a.id.localeCompare(b.id);
  for (const alert of [...currentAlerts].sort(alertOrder)) {
    const identity2 = identityForAlert(alert);
    const selected = unique.get(identity2.sourceRecordId);
    if (!selected) unique.set(identity2.sourceRecordId, alert);
    else unique.set(identity2.sourceRecordId, {
      ...selected,
      isUpdate: selected.isUpdate || alert.isUpdate,
      versionCount: Math.max(
        selected.versionCount || 1,
        alert.versionCount || 1,
        (selected.sourceRecordHash || selected.contentHash) !== (alert.sourceRecordHash || alert.contentHash) ? 2 : 1
      )
    });
  }
  const activeAlerts = [...unique.values()];
  const activeIds = new Set(activeAlerts.map((alert) => alert.id));
  const activePaths = new Set(activeAlerts.map((alert) => officialPagePath(alert.url)).filter(Boolean));
  const activeSourceRecordIds = new Set(activeAlerts.map((alert) => identityForAlert(alert).sourceRecordId));
  const archived = (currentFeed?.alerts ?? []).filter((alert) => {
    if (activeIds.has(alert.id)) return false;
    const identity2 = identityForAlert(alert);
    return !activeSourceRecordIds.has(identity2.sourceRecordId) && !activePaths.has(identity2.officialPagePath);
  });
  const alerts2 = [...activeAlerts, ...archived].sort(alertOrder);
  const dated = alerts2.map((alert) => alert.publishedAt).filter(Boolean).sort();
  const archive = {
    scope: "Archivo p\xFAblico accesible desde el buscador oficial de AESAN",
    totalAlerts: alerts2.length,
    earliestPublishedAt: dated[0] ?? null,
    latestPublishedAt: dated.at(-1) ?? null,
    lastFullSyncAt: options.fullSync ? now : currentFeed?.archive?.lastFullSyncAt ?? null,
    pagesScanned: options.fullSync ? options.pagesScanned ?? null : currentFeed?.archive?.pagesScanned ?? options.pagesScanned ?? null,
    legacyIndexesScanned: options.fullSync ? options.legacyIndexesScanned ?? null : currentFeed?.archive?.legacyIndexesScanned ?? options.legacyIndexesScanned ?? null
  };
  const next = { schemaVersion: 1, source: { name: "AESAN", url: AESAN_LIST_URL }, generatedAt: now, archive, alerts: alerts2 };
  if (currentFeed?.generatedAt && feedSignature(currentFeed) === feedSignature(next)) return currentFeed;
  return next;
}
function previousForCard(alerts2, card, suppliedIdentity = null) {
  const pagePath = officialPagePath(card.url);
  if (!pagePath) return null;
  const identity2 = suppliedIdentity;
  const explicitMatches = identity2 ? alerts2.filter((alert) => {
    if (typeof alert.sourceRecordId !== "string" || !alert.sourceRecordId.trim()) return false;
    return alert.sourceRecordId === identity2.sourceRecordId;
  }) : [];
  const pageMatches = alerts2.filter((alert) => officialPagePath(alert.url) === pagePath);
  const candidates = explicitMatches.length ? explicitMatches : pageMatches;
  if (!candidates.length) return alerts2.find((alert) => card.reference && alert.reference === card.reference) ?? null;
  if (identity2) {
    const conflicting = pageMatches.find((alert) => alert.sourceRecordIdType === "idAlert" && alert.sourceRecordId && alert.sourceRecordId !== identity2.sourceRecordId);
    if (conflicting) throw new Error(`La p\xE1gina ${pagePath} cambi\xF3 de UUID AESAN`);
  }
  const distinctPaths = new Set(candidates.map((alert) => officialPagePath(alert.url)));
  if (distinctPaths.size !== 1) throw new Error("Una identidad AESAN aparece en m\xFAltiples p\xE1ginas oficiales");
  const ordered3 = [...candidates].sort((left, right) => (left.detectedAt || "").localeCompare(right.detectedAt || "") || left.id.localeCompare(right.id));
  const survivor = ordered3[0];
  const matchingReference = candidates.filter((alert) => card.reference && alert.reference === card.reference);
  if (matchingReference.length > 1) throw new Error(`Referencia AESAN duplicada para ${pagePath}`);
  const current = matchingReference[0] ?? [...candidates].sort((left, right) => (right.updatedAt || "").localeCompare(left.updatedAt || "") || right.id.localeCompare(left.id))[0];
  const history = normalizedReferenceHistory([
    ...candidates.flatMap((alert) => alert.referenceHistory ?? []),
    ...candidates.filter((alert) => alert !== current).map(historyEntry)
  ], current);
  return {
    ...current,
    id: survivor.id,
    detectedAt: survivor.detectedAt || current.detectedAt,
    sourceRecordId: identity2?.sourceRecordId ?? current.sourceRecordId,
    sourceRecordIdType: identity2?.sourceRecordIdType ?? current.sourceRecordIdType,
    referenceHistory: history,
    previousReferences: previousReferencesFor2(history, current.reference),
    versionCount: Math.max(1 + history.length, ...candidates.map((alert) => alert.versionCount || 1))
  };
}

// candidate-probe-v4-src/lib/aesan-producer/aesan-publications.mjs
import { createHash as createHash2 } from "node:crypto";
var hash = (value) => createHash2("sha256").update(JSON.stringify(value)).digest("hex");
var fail3 = (code, reference) => {
  throw new Error(`${code}: ${reference || "referencia no disponible"}`);
};
var madridDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
var dayFor = (value) => {
  if (typeof value !== "string" || !value || !Number.isFinite(Date.parse(value))) return null;
  const parts = Object.fromEntries(madridDate.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
var printedDate = (value) => {
  const match = String(value ?? "").trim().match(/^(\d{2})\/(\d{2})\/(20\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/u);
  if (!match) return null;
  const [, d, m, y, h, minute] = match;
  const date = `${y}-${m}-${d}`;
  const parsed = /* @__PURE__ */ new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || h !== void 0 && (+h > 23 || +minute > 59)) return null;
  return { day: date, minute: h === void 0 ? null : +h * 60 + +minute };
};
function publicationDateEvidence(record7) {
  const dates = record7.officialDates ?? [];
  const pageDays = [...new Set(dates.filter((date) => date.sourceField === "pageInfo.date").map((date) => printedDate(date.value)?.day).filter(Boolean))];
  const storedDay = dayFor(record7.publishedAt);
  if (pageDays.length > 1 || pageDays.length === 1 && storedDay && pageDays[0] !== storedDay) {
    fail3("AESAN_PUBLICATION_DATE_CONFLICT", record7.reference);
  }
  const day = pageDays[0] ?? storedDay;
  const times = [...new Set(dates.filter((date) => date.label === "Fecha y hora").map((date) => printedDate(date.value)).filter((date) => date?.day === day && date.minute !== null).map((date) => date.minute))];
  if (times.length > 1) fail3("AESAN_PUBLICATION_TIME_CONFLICT", record7.reference);
  return { day, minute: times[0] ?? null };
}
var linkedFrom = (newer, older) => Boolean(newer.isUpdate && (newer.resources ?? []).some((resource) => resource.kind === "link" && isOfficialAesanAlertUrl2(resource.url) && officialPagePath(resource.url) === officialPagePath(older.url)));
function comparePublications(left, right) {
  const a = publicationDateEvidence(left);
  const b = publicationDateEvidence(right);
  if (a.day && b.day && a.day !== b.day) return a.day > b.day ? 1 : -1;
  if (a.day && a.day === b.day && a.minute !== null && b.minute !== null && a.minute !== b.minute) {
    return a.minute > b.minute ? 1 : -1;
  }
  const leftLinks = linkedFrom(left, right);
  const rightLinks = linkedFrom(right, left);
  if (leftLinks !== rightLinks) return leftLinks ? 1 : -1;
  return null;
}
function publicationCards(cards) {
  const unique = /* @__PURE__ */ new Map();
  for (const card of [...cards].sort((a, b) => String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")) || String(a.url).localeCompare(String(b.url)) || String(a.title).localeCompare(String(b.title)))) {
    if (!isOfficialAesanAlertUrl2(card.url)) fail3("AESAN_INVALID_PUBLICATION_URL", card.reference);
    const path = officialPagePath(card.url);
    if (!unique.has(path)) unique.set(path, card);
  }
  return [...unique.values()];
}
var materialKeys = ["officialTitle", "publishedFields", "materialParagraphs", "resources", "officialDates"];
var materialFor = (record7) => Object.fromEntries(materialKeys.map((key) => [key, record7[key]]));
var materialIsVerifiable = (record7) => record7.sourceRecordSchemaVersion === 2 && typeof record7.officialTitle === "string" && materialKeys.slice(1).every((key) => Array.isArray(record7[key])) && typeof record7.sourceRecordHash === "string" && record7.sourceRecordHash === hash(materialFor(record7));
function publicationSnapshot(record7) {
  if (!materialIsVerifiable(record7)) return null;
  const path = officialPagePath(record7.url);
  const validIdentity2 = record7.sourceRecordIdType === "idAlert" ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(record7.sourceRecordId ?? "") : record7.sourceRecordIdType === "official_page_path" && record7.sourceRecordId === `official_page_path:${path}`;
  if (!path || !validIdentity2) return null;
  return {
    reference: record7.reference,
    sourceRecordId: record7.sourceRecordId,
    sourceRecordIdType: record7.sourceRecordIdType,
    url: record7.url,
    publishedAt: record7.publishedAt ?? null,
    sourceRecordSchemaVersion: 2,
    sourceRecordHash: record7.sourceRecordHash,
    ...materialFor(record7)
  };
}
function mergePublicationHistory(previous, observations, current) {
  const history = previous?.publicationHistory ?? [];
  if (!Array.isArray(history)) fail3("AESAN_INVALID_PUBLICATION_HISTORY", current.reference);
  const snapshots = /* @__PURE__ */ new Map();
  const insert = (record7, strict = false) => {
    const snapshot = publicationSnapshot(record7);
    if (!snapshot) {
      if (strict) fail3("AESAN_INVALID_PUBLICATION_HISTORY", current.reference);
      return;
    }
    const path = officialPagePath(snapshot.url);
    if (!path || !isOfficialAesanAlertUrl2(snapshot.url) || typeof snapshot.reference !== "string") {
      fail3("AESAN_INVALID_PUBLICATION_HISTORY", current.reference);
    }
    const key = `${path}\0${snapshot.sourceRecordHash}`;
    const existing = snapshots.get(key);
    if (existing?.sourceRecordIdType === "idAlert" && snapshot.sourceRecordIdType === "idAlert" && existing.sourceRecordId !== snapshot.sourceRecordId) fail3("AESAN_PUBLICATION_UUID_CONFLICT", current.reference);
    if (!existing || existing.sourceRecordIdType !== "idAlert" || snapshot.sourceRecordIdType === "idAlert") snapshots.set(key, snapshot);
  };
  for (const record7 of history) insert(record7, true);
  if (previous) insert(previous);
  for (const record7 of observations) insert(record7);
  insert(current);
  const references = /* @__PURE__ */ new Set([
    current.reference,
    previous?.reference,
    ...previous?.previousReferences ?? [],
    ...current.previousReferences ?? [],
    ...(previous?.referenceHistory ?? []).map((entry) => entry.reference),
    ...(current.referenceHistory ?? []).map((entry) => entry.reference)
  ]);
  if ([...snapshots.values()].some((record7) => !references.has(record7.reference))) {
    fail3("AESAN_UNRELATED_PUBLICATION_HISTORY", current.reference);
  }
  validateObservedIdentities([...snapshots.values()]);
  const values = [...snapshots.values()].sort((a, b) => String(a.publishedAt ?? "").localeCompare(String(b.publishedAt ?? "")) || a.url.localeCompare(b.url) || a.sourceRecordHash.localeCompare(b.sourceRecordHash));
  return values.length > 1 || history.length ? values : null;
}
function validateObservedIdentities(records) {
  const identityPaths = /* @__PURE__ */ new Map();
  const pathIdentities = /* @__PURE__ */ new Map();
  for (const record7 of records) {
    const path = officialPagePath(record7.url);
    const priorPath = identityPaths.get(record7.sourceRecordId);
    if (priorPath && priorPath !== path) fail3("AESAN_PUBLICATION_ID_MULTIPLE_PATHS", record7.reference);
    identityPaths.set(record7.sourceRecordId, path);
    if (record7.sourceRecordIdType === "idAlert") {
      const priorId = pathIdentities.get(path);
      if (priorId && priorId !== record7.sourceRecordId) fail3("AESAN_PUBLICATION_UUID_CONFLICT", record7.reference);
      pathIdentities.set(path, record7.sourceRecordId);
    }
  }
}
var REVIEWED_PARALLEL_GROUPS = [{
  reference: "ES2026/085",
  day: "2026-02-20",
  minute: 14 * 60 + 30,
  anchorSourceRecordId: "044c1491-6df9-4ab4-a22c-1e11b0bf1761",
  members: [
    { sourceRecordId: "044c1491-6df9-4ab4-a22c-1e11b0bf1761", path: "/alertas/2026_10" },
    { sourceRecordId: "683af0bb-f665-4239-a34e-2911bedf5499", path: "/alertas/2026_11" }
  ]
}];
function selectReviewedParallelPublications(previous, candidates) {
  const references = new Set(candidates.map(({ record: record7 }) => record7.reference));
  if (references.size !== 1) return null;
  const group = REVIEWED_PARALLEL_GROUPS.find((item) => references.has(item.reference));
  if (!group) return null;
  const priorSelection = previous?.publicationSelection;
  if (priorSelection && (priorSelection.status !== "parallel_publications" || priorSelection.basis !== "reviewed_shared_reference" || priorSelection.chronological !== false || priorSelection.anchorSourceRecordId !== group.anchorSourceRecordId || !Array.isArray(priorSelection.members) || priorSelection.members.length !== group.members.length || new Set(priorSelection.members.map((item) => item.sourceRecordId)).size !== group.members.length)) {
    fail3("AESAN_INVALID_PUBLICATION_SELECTION", group.reference);
  }
  const byPath = new Map(candidates.map((entry) => [officialPagePath(entry.record.url), entry]));
  if (priorSelection) {
    for (const member of priorSelection.members) {
      const expected = group.members.find((item) => item.sourceRecordId === member.sourceRecordId);
      if (!expected || officialPagePath(member.url) !== expected.path) {
        fail3("AESAN_INVALID_PUBLICATION_SELECTION", group.reference);
      }
      const record7 = previous.publicationHistory?.find((item) => item.sourceRecordId === member.sourceRecordId && item.sourceRecordHash === member.sourceRecordHash && officialPagePath(item.url) === expected.path);
      if (!record7 || !materialIsVerifiable(record7)) fail3("AESAN_INVALID_PUBLICATION_SELECTION", group.reference);
      if (!byPath.has(expected.path)) byPath.set(expected.path, { record: record7, verified: false });
    }
  }
  const entries = [...byPath.values()];
  if (entries.length === 1 && !priorSelection) return null;
  if (entries.length !== group.members.length) fail3("AESAN_PARALLEL_PUBLICATION_REVIEW_REQUIRED", group.reference);
  for (const entry of entries) {
    const record7 = entry.record;
    const expected = group.members.find((item) => item.sourceRecordId === record7.sourceRecordId);
    const date = publicationDateEvidence(record7);
    if (!expected || record7.sourceRecordIdType !== "idAlert" || officialPagePath(record7.url) !== expected.path || record7.reference !== group.reference || !materialIsVerifiable(record7) || record7.isUpdate === true || /ampliaci[oó]n|actualizaci[oó]n|correcci[oó]n/iu.test(record7.officialTitle) || date.day !== group.day || date.minute !== group.minute) {
      fail3("AESAN_PARALLEL_PUBLICATION_REVIEW_REQUIRED", group.reference);
    }
  }
  validateObservedIdentities(entries.map(({ record: record7 }) => record7));
  if (previous && previous.sourceRecordId !== group.anchorSourceRecordId) {
    fail3("AESAN_PARALLEL_ANCHOR_CONFLICT", group.reference);
  }
  const selected = entries.find(({ record: record7 }) => record7.sourceRecordId === group.anchorSourceRecordId);
  return {
    selected,
    selection: {
      status: "parallel_publications",
      basis: "reviewed_shared_reference",
      chronological: false,
      anchorSourceRecordId: group.anchorSourceRecordId,
      members: group.members.map(({ sourceRecordId }) => {
        const { record: record7 } = entries.find((entry) => entry.record.sourceRecordId === sourceRecordId);
        return { sourceRecordId, url: record7.url, sourceRecordHash: record7.sourceRecordHash };
      })
    }
  };
}
function reconcilePublicationBatch(previousAlerts, observations, now) {
  const groups = /* @__PURE__ */ new Map();
  const parsed = [];
  for (const observation of observations) {
    const { card, html } = observation;
    const identity2 = html === null ? null : sourceIdentityForHtml(html, card.url);
    const raw = html === null ? null : parseDetail(html, card, null, now, identity2);
    const lookup = raw ?? card;
    const referenceMatches = previousAlerts.filter((alert) => lookup.reference && alert.reference === lookup.reference);
    if (new Set(referenceMatches.map((alert) => alert.id)).size > 1) {
      fail3("AESAN_AMBIGUOUS_PREVIOUS_CASE", lookup.reference);
    }
    const previous = previousForCard(previousAlerts, lookup, identity2);
    if (raw && previous) validateObservedIdentities([raw, previous]);
    const record7 = raw ?? previous ?? cardFallback(card, null, now);
    const key = previous?.id ?? record7.id;
    if (!groups.has(key)) groups.set(key, { previous, entries: [] });
    const group = groups.get(key);
    if (group.previous && previous && group.previous.id !== previous.id) fail3("AESAN_AMBIGUOUS_PREVIOUS_CASE", record7.reference);
    group.previous ??= previous;
    group.entries.push({ record: record7, observation, identity: identity2, verified: html !== null });
    if (raw) parsed.push(raw);
  }
  validateObservedIdentities(parsed);
  const result = [];
  for (const { previous, entries } of groups.values()) {
    const pages = /* @__PURE__ */ new Map();
    for (const entry of entries.filter((item) => item.verified || !previous)) {
      const path = officialPagePath(entry.record.url);
      const prior = pages.get(path);
      if (prior && prior.record.sourceRecordHash !== entry.record.sourceRecordHash) {
        fail3("AESAN_CONFLICTING_PUBLICATION_RESPONSES", entry.record.reference);
      }
      if (!prior || entry.verified) pages.set(path, entry);
    }
    if (previous && !pages.has(officialPagePath(previous.url))) {
      pages.set(officialPagePath(previous.url), { record: previous, verified: false });
    }
    const candidates = [...pages.values()];
    const parallel = selectReviewedParallelPublications(previous, candidates);
    if (previous?.publicationSelection && !parallel) {
      fail3("AESAN_PARALLEL_PUBLICATION_REVIEW_REQUIRED", previous.reference);
    }
    const maxima = parallel ? [parallel.selected] : candidates.filter((candidate) => !candidates.some((other) => other !== candidate && comparePublications(other.record, candidate.record) === 1));
    if (maxima.length !== 1) fail3("AESAN_PUBLICATION_ORDER_UNPROVEN", previous?.reference ?? candidates[0]?.record.reference);
    const selected = maxima[0];
    if (!parallel && candidates.some((other) => other !== selected && comparePublications(selected.record, other.record) !== 1)) {
      fail3("AESAN_PUBLICATION_ORDER_UNPROVEN", selected.record.reference);
    }
    const current = selected.verified ? parseDetail(selected.observation.html, selected.observation.card, previous, now, selected.identity) : selected.record;
    const history = mergePublicationHistory(previous, entries.filter((entry) => entry.verified).map((entry) => entry.record), current);
    const enriched = history ? { ...current, publicationHistory: history } : current;
    result.push(parallel ? { ...enriched, publicationSelection: parallel.selection } : enriched);
  }
  return result;
}

// candidate-probe-v4-src/lib/aesan-producer/aesan-taxonomy.mjs
import { createHash as createHash3 } from "node:crypto";
var ALERT_TYPES = Object.freeze({
  general_population: Object.freeze({ code: "general_population", sourceTypeId: "b5c27f12-7f21-4d2e-bc5c-d5186b4d6259", officialLabel: "Alertas alimentarias de inter\xE9s para toda la poblaci\xF3n" }),
  allergy_intolerance_adverse: Object.freeze({ code: "allergy_intolerance_adverse", sourceTypeId: "8c7503b4-b714-4c08-9d8e-0039a2d03624", officialLabel: "Alertas alimentarias para personas con alergias, intolerancias u otros efectos adversos a determinadas sustancias" }),
  food_supplements: Object.freeze({ code: "food_supplements", sourceTypeId: "649ce619-367b-4ad2-96cd-27b905fb6020", officialLabel: "Alertas alimentarias para personas que consumen complementos alimenticios" })
});
var LANDING_URL = "https://www.aesan.gob.es/alertas/alertas-alimentarias";
var codes = Object.keys(ALERT_TYPES).sort();
var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
var attr = (tag, name) => decodeEntities(tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.[1] ?? tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.[2] ?? "");
var plain = (html) => decodeEntities(html.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ")).trim();
var fail4 = (reason) => {
  throw new Error(`AESAN_TAXONOMY_DRIFT ${reason}`);
};
var exactTuple = (code) => ({ ...ALERT_TYPES[code] });
function officialPublicationUrl(value) {
  try {
    const url = new URL(value, "https://www.aesan.gob.es");
    if (url.protocol !== "http:" && url.protocol !== "https:" || url.hostname !== "www.aesan.gob.es" || url.search || url.hash || url.username || url.password || !/^\/alertas\/[^/]+$/u.test(url.pathname) || !isOfficialAesanAlertUrl2(url.href)) return null;
    return `https://www.aesan.gob.es${url.pathname}`;
  } catch {
    return null;
  }
}
function selector(html) {
  const block = html.match(/<select\b[^>]*\bid\s*=\s*["']filter-select["'][^>]*>([\s\S]*?)<\/select>/iu)?.[1];
  if (!block) fail4("missing search selector");
  const options = [...block.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/giu)].filter((match) => !(attr(match[1], "value") === "" && /\bdisabled\b/iu.test(match[1]) && plain(match[2]) === "Tipo de alerta")).map((match) => ({ sourceTypeId: attr(match[1], "value"), officialLabel: plain(match[2]) }));
  if (options.length !== codes.length) fail4(`search selector has ${options.length} categories`);
  const found = /* @__PURE__ */ new Set();
  for (const option of options) {
    const expected = Object.values(ALERT_TYPES).find(({ sourceTypeId }) => sourceTypeId === option.sourceTypeId);
    if (!expected || found.has(expected.code) || option.officialLabel !== expected.officialLabel) fail4(`search selector category changed: ${JSON.stringify(option)}`);
    found.add(expected.code);
  }
  return found;
}
function landing(html) {
  const categoryLinks = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']*\/alertas\/buscador-alertas\?type=[^"']+)["'][^>]*>/giu)].map((match) => new URL(decodeEntities(match[1]), LANDING_URL).searchParams.get("type"));
  if (categoryLinks.length !== codes.length || new Set(categoryLinks).size !== codes.length || categoryLinks.some((id) => !Object.values(ALERT_TYPES).some((type) => type.sourceTypeId === id)))
    fail4("landing category links changed");
  const headings = [...html.matchAll(/<h2\b[^>]*\bdata-section\s*=\s*["']([^"']+)["'][^>]*>/giu)];
  const relevant = headings.filter((heading) => decodeEntities(heading[1]).startsWith("Alertas alimentarias "));
  if (relevant.length !== codes.length) fail4(`landing has ${relevant.length} category headings`);
  const found = /* @__PURE__ */ new Set();
  for (let i = 0; i < relevant.length; i += 1) {
    const label = decodeEntities(relevant[i][1]);
    const block = html.slice(relevant[i].index, relevant[i + 1]?.index ?? html.length);
    const links = [...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu)].filter((match) => attr(match[1], "title") === "Ver todas");
    if (links.length !== 1) fail4(`landing link missing/duplicated: ${label}`);
    const link = new URL(attr(links[0][1], "href"), LANDING_URL);
    const expected = Object.values(ALERT_TYPES).find(({ officialLabel }) => officialLabel === label);
    if (!expected || found.has(expected.code) || link.origin !== "https://www.aesan.gob.es" || link.pathname !== "/alertas/buscador-alertas" || link.searchParams.getAll("type").length !== 1 || link.searchParams.get("type") !== expected.sourceTypeId) fail4(`landing category changed: ${label} ${link}`);
    found.add(expected.code);
  }
  return found;
}
function validateControls(landingHtml, searchHtml) {
  const onLanding = landing(landingHtml);
  const onSearch = selector(searchHtml);
  if (codes.some((code) => !onLanding.has(code) || !onSearch.has(code))) fail4("landing/search selector mismatch");
}
function filteredUrl(code, page = 1) {
  const type = ALERT_TYPES[code];
  if (!type || !Number.isSafeInteger(page) || page < 1) fail4("invalid filtered URL request");
  const url = new URL(page === 1 ? AESAN_LIST_URL : `${AESAN_LIST_URL}/${page}`);
  url.searchParams.set("type", type.sourceTypeId);
  return url.href;
}
function parseFilteredPage(html, code, page) {
  selector(html);
  const type = ALERT_TYPES[code];
  const selected = html.match(/<select\b[^>]*\bid\s*=\s*["']filter-select["'][^>]*\bvalue\s*=\s*["']([^"']+)["']/iu)?.[1];
  if (selected !== type.sourceTypeId) fail4(`filtered response type mismatch ${code} page ${page}`);
  const result = html.match(/<div\b[^>]*\bclass\s*=\s*["']result__info["'][^>]*>([\s\S]*?)<\/div>/iu);
  const range = plain(result?.[1] ?? "").match(/^(\d+)\s*-\s*(\d+)\s+de\s+(\d+)$/u);
  if (!range) fail4(`missing result range ${code} page ${page}`);
  const [start, end, total] = range.slice(1).map(Number);
  const lastPage = Math.ceil(total / 20);
  const pagination = html.match(/<nav\b[^>]*\bclass\s*=\s*["'][^"']*\bpagination\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/iu)?.[0];
  if (!pagination && (lastPage !== 1 || page !== 1)) fail4(`missing pagination ${code} page ${page}`);
  let linkedPages = [];
  if (pagination) {
    const active = pagination.match(/<li\b[^>]*\bclass\s*=\s*["'][^"']*\bpagination__active\b[^"']*["'][^>]*\baria-label\s*=\s*["']page\s+(\d+)["']/iu)?.[1];
    if (Number(active) !== page) fail4(`wrong active page ${code} page ${page}`);
    linkedPages = [...pagination.matchAll(/<a\b([^>]*)>/giu)].flatMap((match) => {
      const href = attr(match[1], "href");
      if (!href || href === "#") return [];
      const url = new URL(href, AESAN_LIST_URL);
      if (url.hostname !== "www.aesan.gob.es" || url.searchParams.get("type") !== type.sourceTypeId || !/^\/alertas\/buscador-alertas(?:\/\d+)?$/u.test(url.pathname)) fail4(`pagination link changed ${code} page ${page}`);
      return [url.pathname === "/alertas/buscador-alertas" ? 1 : Number(url.pathname.split("/").at(-1))];
    });
  }
  const cards = [...html.matchAll(/<a\b([^>]*\bclass\s*=\s*["'][^"']*\bseeMoreCard\b[^"']*["'][^>]*)>[\s\S]*?<\/a>/giu)];
  const urls = cards.map((match) => officialPublicationUrl(attr(match[1], "href")));
  if (urls.some((url) => !url) || start !== (page - 1) * 20 + 1 || end !== Math.min(page * 20, total) || cards.length !== end - start + 1 || page > lastPage || linkedPages.some((linked) => linked < 1 || linked > lastPage) || lastPage > 1 && page === 1 && !linkedPages.includes(lastPage) || total < 1) fail4(`incomplete filtered page ${code} page ${page}`);
  if (page < lastPage && !linkedPages.includes(page + 1) || page === lastPage && linkedPages.includes(page + 1))
    fail4(`pagination continuation changed ${code} page ${page}`);
  return { code, page, total, lastPage, raw: cards.length, urls };
}
async function scanOfficialTaxonomy(fetchHtml, { maxPages = 200, onPage = () => {
} } = {}) {
  const [landingHtml, searchHtml] = await Promise.all([fetchHtml(LANDING_URL), fetchHtml(AESAN_LIST_URL)]);
  validateControls(landingHtml, searchHtml);
  const provenance2 = [
    { url: LANDING_URL, sha256: createHash3("sha256").update(landingHtml).digest("hex") },
    { url: AESAN_LIST_URL, sha256: createHash3("sha256").update(searchHtml).digest("hex") }
  ];
  const memberships = /* @__PURE__ */ new Map();
  const metrics = [];
  for (const code of codes) {
    const firstUrl = filteredUrl(code);
    const firstHtml = await fetchHtml(firstUrl);
    const first = parseFilteredPage(firstHtml, code, 1);
    if (first.lastPage > maxPages) fail4(`filtered page limit exceeded ${code}: ${first.lastPage}`);
    const pages = [first];
    onPage(firstUrl, firstHtml);
    provenance2.push({ url: firstUrl, sha256: createHash3("sha256").update(firstHtml).digest("hex") });
    const pending = Array.from({ length: first.lastPage - 1 }, (_, index2) => index2 + 2);
    const loaded = new Array(pending.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(5, pending.length) }, async () => {
      while (cursor < pending.length) {
        const index2 = cursor++;
        const page = pending[index2];
        loaded[index2] = await fetchHtml(filteredUrl(code, page));
      }
    }));
    for (let page = 2; page <= first.lastPage; page += 1) {
      const url = filteredUrl(code, page);
      const html = loaded[page - 2];
      const parsed = parseFilteredPage(html, code, page);
      if (parsed.total !== first.total || parsed.lastPage !== first.lastPage) fail4(`filtered pagination shifted ${code} page ${page}`);
      onPage(url, html);
      provenance2.push({ url, sha256: createHash3("sha256").update(html).digest("hex") });
      pages.push(parsed);
    }
    const unique = new Set(pages.flatMap(({ urls }) => urls));
    metrics.push({ code, pages: pages.length, raw: pages.reduce((n, page) => n + page.raw, 0), unique: unique.size });
    for (const url of unique) {
      const matches = memberships.get(url) ?? [];
      matches.push(exactTuple(code));
      memberships.set(url, matches);
    }
  }
  for (const [url, matches] of memberships) if (matches.length > 1) fail4(`publication appears in multiple categories ${url}`);
  return { memberships, metrics, provenance: provenance2 };
}
function publicationMembers(alert) {
  const items = [
    { sourceRecordId: alert.sourceRecordId, sourceRecordIdType: alert.sourceRecordIdType, url: alert.url },
    ...alert.publicationHistory ?? [],
    ...(alert.publicationSelection?.members ?? []).map((member) => ({
      ...member,
      sourceRecordIdType: (alert.publicationHistory ?? []).find((entry) => entry.sourceRecordId === member.sourceRecordId)?.sourceRecordIdType ?? "idAlert"
    }))
  ];
  const byUrl = /* @__PURE__ */ new Map();
  const byId = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (typeof item.sourceRecordId !== "string" || typeof item.url !== "string" || !officialPublicationUrl(item.url) || officialPublicationUrl(item.url) !== item.url || !(item.sourceRecordIdType === "idAlert" && uuid.test(item.sourceRecordId) || item.sourceRecordIdType === "official_page_path" && item.sourceRecordId === `official_page_path:${new URL(item.url).pathname}`))
      fail4(`invalid preserved identity ${alert.reference}`);
    const previous = byUrl.get(item.url);
    if (previous && previous.sourceRecordId !== item.sourceRecordId || byId.has(item.sourceRecordId) && byId.get(item.sourceRecordId) !== item.url)
      fail4(`URL\u2194UUID conflict ${alert.reference} ${item.url}`);
    byUrl.set(item.url, { sourceRecordId: item.sourceRecordId, sourceRecordIdType: item.sourceRecordIdType, url: item.url });
    byId.set(item.sourceRecordId, item.url);
  }
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url, "en") || a.sourceRecordId.localeCompare(b.sourceRecordId, "en"));
}
function projectClassification(alert, memberships) {
  const publications = publicationMembers(alert).map((member) => ({
    ...member,
    matches: [...memberships.get(member.url) ?? []].sort((a, b) => a.code.localeCompare(b.code, "en"))
  }));
  const known = publications.flatMap(({ matches }) => matches);
  const conflict = publications.some(({ matches }) => matches.length > 1) || new Set(known.map(({ code }) => code)).size > 1;
  const status = conflict ? "conflict" : publications.some(({ matches }) => matches.length === 0) ? "unknown" : "known";
  const tuple2 = status === "known" ? known[0] : null;
  return {
    schemaVersion: 1,
    status,
    code: tuple2?.code ?? null,
    sourceTypeId: tuple2?.sourceTypeId ?? null,
    officialLabel: tuple2?.officialLabel ?? null,
    publications
  };
}
function enrichFeedTaxonomy(feed, scan, { reviewed = [] } = {}) {
  const prior = /* @__PURE__ */ new Map();
  for (const alert of feed.alerts) for (const publication of alert.aesanAlertClassification?.publications ?? []) {
    const old = prior.get(publication.url);
    if (old && old.sourceRecordId !== publication.sourceRecordId) fail4(`prior URL\u2194UUID conflict ${publication.url}`);
    prior.set(publication.url, publication);
  }
  for (const item of reviewed) if (item.code) {
    const old = prior.get(item.url);
    if (!old) prior.set(item.url, { sourceRecordId: item.sourceRecordId, matches: [exactTuple(item.code)] });
  }
  const identities = /* @__PURE__ */ new Map();
  const urls = /* @__PURE__ */ new Map();
  const present = /* @__PURE__ */ new Set();
  const alerts2 = feed.alerts.map((alert) => {
    const taxonomy = projectClassification(alert, scan.memberships);
    if (taxonomy.status === "conflict") fail4(`conflicting official classifications ${alert.reference}`);
    for (const publication of taxonomy.publications) {
      present.add(publication.url);
      const id = identities.get(publication.sourceRecordId);
      const url = urls.get(publication.url);
      if (id && id !== publication.url || url && url !== publication.sourceRecordId) fail4(`URL\u2194UUID conflict ${publication.url}`);
      identities.set(publication.sourceRecordId, publication.url);
      urls.set(publication.url, publication.sourceRecordId);
      const previous = prior.get(publication.url);
      if (previous && previous.sourceRecordId !== publication.sourceRecordId) fail4(`reviewed URL\u2194UUID conflict ${publication.url}`);
      if (previous?.matches?.length === 1 && publication.matches.length === 1 && previous.matches[0].code !== publication.matches[0].code)
        fail4(`unreviewed category change ${publication.url}`);
    }
    return { ...alert, aesanAlertClassification: taxonomy };
  });
  const gaps = [...scan.memberships.keys()].filter((url) => !present.has(url)).sort();
  const unknown = alerts2.filter((alert) => alert.aesanAlertClassification.status === "unknown").map((alert) => ({ reference: alert.reference, urls: alert.aesanAlertClassification.publications.filter((p) => !p.matches.length).map((p) => p.url) }));
  const disappeared = [...prior].filter(([url, value]) => value.matches?.length && present.has(url) && !scan.memberships.has(url)).map(([url]) => url);
  return { feed: { ...feed, alerts: alerts2 }, diagnostics: { gaps, unknown, disappeared } };
}

// candidate-probe-v4-src/lib/aesan-producer/recent.mjs
async function produceAesanRecent({ previousAlerts, fetchHtml, now, reviewed, fullHistory = false }) {
  const cache = /* @__PURE__ */ new Map();
  const html = (url) => {
    if (!cache.has(url)) cache.set(url, fetchHtml(url));
    return cache.get(url);
  };
  const taxonomy = await scanOfficialTaxonomy(html, { maxPages: 40 });
  const listing = [];
  const listUrl = (page) => {
    const url = new URL(page === 1 ? AESAN_LIST_URL : `${AESAN_LIST_URL}/${page}`);
    if (fullHistory) {
      const date = new Date(now);
      url.searchParams.set("filter-initDate", "01/01/2000");
      url.searchParams.set("filter-endDate", [String(date.getUTCDate()).padStart(2, "0"), String(date.getUTCMonth() + 1).padStart(2, "0"), date.getUTCFullYear()].join("/"));
      url.searchParams.set("quantity", "40");
    }
    return url.href;
  };
  const first = await html(listUrl(1));
  listing.push(first);
  const lastPage = fullHistory ? Math.max(1, ...[...first.matchAll(/(?:href|action)\s*=\s*["'][^"']*\/buscador-alertas\/(\d+)(?:[?"'])/giu)].map((match) => Number(match[1])).filter(Number.isFinite)) : 4;
  if (lastPage > 40) throw Error("AESAN_NATIVE archive page budget exceeded");
  for (let page = 2; page <= lastPage; page++) listing.push(await html(listUrl(page)));
  if (fullHistory) {
    let total = null;
    const urls = [];
    for (let i = 0; i < listing.length; i++) {
      const info = stripHtml(listing[i].match(/<div\b[^>]*\bclass\s*=\s*["']result__info["'][^>]*>([\s\S]*?)<\/div>/iu)?.[1] ?? "");
      const range = info.match(/^(\d+)\s*-\s*(\d+)\s+de\s+(\d+)$/u);
      if (!range) throw Error("AESAN_NATIVE archive range unavailable");
      const [begin, end, count] = range.slice(1).map(Number), cards2 = parseListCards(listing[i]);
      total ??= count;
      if (count !== total || begin !== i * 40 + 1 || end !== Math.min((i + 1) * 40, total) || cards2.length !== end - begin + 1 || lastPage !== Math.ceil(total / 40)) throw Error("AESAN_NATIVE archive pagination incomplete");
      urls.push(...cards2.map((card) => card.url));
    }
    if (new Set(urls).size !== total) throw Error("AESAN_NATIVE duplicate or missing archive publication");
  }
  const primary = listing.flatMap(parseListCards);
  if (!primary.length) throw Error("AESAN_NATIVE primary discovery empty");
  const landing2 = parseListCards((await html(LANDING_URL)).replace(/\bseeMoreCardSlide\b/gu, "seeMoreCard seeMoreCardSlide"));
  if (!landing2.length) throw Error("AESAN_NATIVE secondary discovery empty");
  for (let i = 0; i < landing2.length; i++) if (!landing2[i].reference) {
    const card = landing2[i], page = await html(card.url);
    const record7 = parseDetail(page, card, null, now, sourceIdentityForHtml(page, card.url));
    landing2[i] = { ...card, title: record7.title, reference: record7.reference, publishedAt: record7.publishedAt || card.publishedAt };
  }
  const cards = publicationCards([...primary, ...landing2]);
  if (cards.length > (fullHistory ? 300 : 140)) throw Error("AESAN_NATIVE discovery budget exceeded");
  const mapLimit3 = async (items, mapper) => {
    const results = new Array(items.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
      while (cursor < items.length) {
        const index2 = cursor++;
        results[index2] = await mapper(items[index2]);
      }
    }));
    return results;
  };
  const observations = await mapLimit3(cards, async (card) => ({ card, html: await html(card.url) }));
  const alerts2 = reconcilePublicationBatch(previousAlerts, observations, now);
  const base = assembleFeed({ schemaVersion: 1, source: { name: "AESAN", url: AESAN_LIST_URL }, alerts: previousAlerts }, alerts2, now, { fullSync: fullHistory, pagesScanned: listing.length, legacyIndexesScanned: 0 });
  const { feed, diagnostics } = enrichFeedTaxonomy(base, taxonomy, { reviewed });
  if (diagnostics.disappeared.length || diagnostics.unknown.length || fullHistory && diagnostics.gaps.length) throw Error("AESAN_NATIVE taxonomy membership requires review");
  const members = new Map(feed.alerts.flatMap(publicationMembers).map((member) => [member.url, member]));
  if (members.size > 300) throw Error("AESAN_NATIVE publication identity budget exceeded");
  await mapLimit3([...members.values()], async (member) => {
    if (!officialPagePath(member.url)) throw Error("AESAN_NATIVE invalid official path");
    const identity2 = sourceIdentityForHtml(await html(member.url), member.url);
    if (identity2.sourceRecordId !== member.sourceRecordId || identity2.sourceRecordIdType !== member.sourceRecordIdType) throw Error("AESAN_NATIVE official identity drift");
  });
  const observedIds = new Set(alerts2.map((x) => x.id));
  return { alerts: feed.alerts.filter((x) => observedIds.has(x.id)), pagesScanned: listing.length, publicationsChecked: members.size };
}

// candidate-probe-v4-src/lib/aesan-producer/reviewed.json
var reviewed_default = {
  source: "https://github.com/cgam-coder/vigia-runtime/issues/88#issuecomment-5814229570",
  annexComments: [
    5814188646,
    5814190036
  ],
  capturedDate: "2026-09-24",
  publications: [
    {
      reference: "ES2025/002",
      url: "https://www.aesan.gob.es/alertas/2024_94",
      sourceRecordId: "a197a26e-2e13-4884-82ec-fde1d5c0981c",
      code: "general_population"
    },
    {
      reference: "ES2025/007",
      url: "https://www.aesan.gob.es/alertas/2025_01",
      sourceRecordId: "d064939e-65f6-4208-9ad2-e2319944c9e7",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/020",
      url: "https://www.aesan.gob.es/alertas/2025_02",
      sourceRecordId: "6928d8a9-8df8-4583-a833-5557ec901e45",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/036",
      url: "https://www.aesan.gob.es/alertas/2025_03",
      sourceRecordId: "3576ffb3-12ed-49e3-9ea6-dfffad2bcd09",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/050",
      url: "https://www.aesan.gob.es/alertas/2025_04",
      sourceRecordId: "dadd5a49-d916-4efa-beee-0375606948a8",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/055",
      url: "https://www.aesan.gob.es/alertas/2025_06",
      sourceRecordId: "690f969b-8acd-465a-bcf9-c827bb0709af",
      code: "general_population"
    },
    {
      reference: "ES2025/057",
      url: "https://www.aesan.gob.es/alertas/2025_07",
      sourceRecordId: "fc0b40af-350d-43ea-80ba-e7f4e0945c93",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/085",
      url: "https://www.aesan.gob.es/alertas/2025_08",
      sourceRecordId: "95fe7817-09fb-4e51-b0d2-14e06b6a376f",
      code: "food_supplements"
    },
    {
      reference: "ES2025/108",
      url: "https://www.aesan.gob.es/alertas/2025_09",
      sourceRecordId: "4a55c27a-9d7e-42f3-abbf-0be8e3b8f90d",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/121",
      url: "https://www.aesan.gob.es/alertas/2025_10",
      sourceRecordId: "b7f4fd9a-fa43-447f-aca8-76ac46f66125",
      code: "food_supplements"
    },
    {
      reference: "ES2025/133",
      url: "https://www.aesan.gob.es/alertas/2025_11",
      sourceRecordId: "f9578c29-6661-4a32-afa3-ac44fce385d8",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/139",
      url: "https://www.aesan.gob.es/alertas/2025_12",
      sourceRecordId: "c8b11ff2-7339-4363-8767-93d2754f8041",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/156",
      url: "https://www.aesan.gob.es/alertas/2025_14_Amp",
      sourceRecordId: "3f04b4f1-0a11-477b-aa4d-d0830dbbdd13",
      code: "general_population"
    },
    {
      reference: "ES2025/159",
      url: "https://www.aesan.gob.es/alertas/2025_14",
      sourceRecordId: "b4f8f7e2-efe4-416d-85dc-fed656a58e95",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/174",
      url: "https://www.aesan.gob.es/alertas/2025_15",
      sourceRecordId: "7c21439d-9f4f-47f7-886f-0a601e19aa3f",
      code: "general_population"
    },
    {
      reference: "ES2025/181",
      url: "https://www.aesan.gob.es/alertas/2025_16",
      sourceRecordId: "0071ce43-9c79-43d5-aeca-906b03eb440e",
      code: "general_population"
    },
    {
      reference: "ES2025/191",
      url: "https://www.aesan.gob.es/alertas/2025_17",
      sourceRecordId: "a634d637-1fce-4780-907b-bbfe05148164",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/198",
      url: "https://www.aesan.gob.es/alertas/2025_18",
      sourceRecordId: "a4fc95d3-a5ef-4a41-8249-55566faf9ee9",
      code: "general_population"
    },
    {
      reference: "ES2025/204",
      url: "https://www.aesan.gob.es/alertas/2025_19",
      sourceRecordId: "c84a4bf7-04f7-4ffc-9a71-15b42a3b3162",
      code: "food_supplements"
    },
    {
      reference: "ES2025/205",
      url: "https://www.aesan.gob.es/alertas/2025_20",
      sourceRecordId: "6ca7ed35-2f89-424f-8bf5-57ca9ecaea90",
      code: "general_population"
    },
    {
      reference: "ES2025/206",
      url: "https://www.aesan.gob.es/alertas/2025_21",
      sourceRecordId: "0c5be4ca-ea90-41cf-a309-607375bf5314",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/208",
      url: "https://www.aesan.gob.es/alertas/2025_22",
      sourceRecordId: "4035b5b7-457b-4697-8b07-fb79aa22c9f8",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/227",
      url: "https://www.aesan.gob.es/alertas/2025_23",
      sourceRecordId: "f24df06f-f4df-4205-9f47-bd1209dc192b",
      code: "general_population"
    },
    {
      reference: "ES2025/277",
      url: "https://www.aesan.gob.es/alertas/2025_24",
      sourceRecordId: "b82978ed-43fa-437a-b3c2-d318decc1f27",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/289",
      url: "https://www.aesan.gob.es/alertas/2025_25",
      sourceRecordId: "a15102cb-69db-4331-9aa3-e7447bf40bad",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/292",
      url: "https://www.aesan.gob.es/alertas/2025_26",
      sourceRecordId: "2dde6286-00e2-47af-a616-c8f87bb1c44c",
      code: "general_population"
    },
    {
      reference: "ES2025/312",
      url: "https://www.aesan.gob.es/alertas/2025_27",
      sourceRecordId: "8a95c76e-12f1-4974-8675-c79162753042",
      code: "general_population"
    },
    {
      reference: "ES2025/335",
      url: "https://www.aesan.gob.es/alertas/2025_28",
      sourceRecordId: "5d376caa-bdaf-4df5-84fd-9ca0a541a45e",
      code: "food_supplements"
    },
    {
      reference: "ES2025/340",
      url: "https://www.aesan.gob.es/alertas/2025_29",
      sourceRecordId: "6c39a2a8-a2c2-43a0-9524-0549a372038f",
      code: "general_population"
    },
    {
      reference: "ES2025/340",
      url: "https://www.aesan.gob.es/alertas/2025_29_Amp",
      sourceRecordId: "fd1913d4-d472-4166-ac8b-b12356c050a3",
      code: "general_population"
    },
    {
      reference: "ES2025/361",
      url: "https://www.aesan.gob.es/alertas/2025_30",
      sourceRecordId: "bb53d9a0-0f73-4f00-a9ac-a870a18b1e97",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/373",
      url: "https://www.aesan.gob.es/alertas/2025_31",
      sourceRecordId: "d84d719f-c483-43a5-bb45-4633f8105209",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/374",
      url: "https://www.aesan.gob.es/alertas/2025_32",
      sourceRecordId: "9ad0344d-f047-4d30-a431-06871338f75f",
      code: "food_supplements"
    },
    {
      reference: "ES2025/375",
      url: "https://www.aesan.gob.es/alertas/2025_33",
      sourceRecordId: "5ec5fcd5-a32d-46b1-86e2-af2901671a4e",
      code: "general_population"
    },
    {
      reference: "ES2025/385",
      url: "https://www.aesan.gob.es/alertas/2025_34",
      sourceRecordId: "7b79c1c6-cf18-46bd-b417-5124bb38bfb4",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/392",
      url: "https://www.aesan.gob.es/alertas/2025_35",
      sourceRecordId: "d8b184c4-f779-4211-bfc7-f2c9c12e8264",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/414",
      url: "https://www.aesan.gob.es/alertas/2025_38",
      sourceRecordId: "4fce1e17-bd73-4b5b-92a4-235ac532c56a",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/417",
      url: "https://www.aesan.gob.es/alertas/2025_36",
      sourceRecordId: "7e308a67-22d8-44bc-b1dd-78e299160128",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/417",
      url: "https://www.aesan.gob.es/alertas/2025_41",
      sourceRecordId: "2bef9ce5-f243-4267-a325-4473ef7b9d27",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/424",
      url: "https://www.aesan.gob.es/alertas/2025_37",
      sourceRecordId: "7847cabd-5e64-4df6-bd65-67abe42f8d3c",
      code: "general_population"
    },
    {
      reference: "ES2025/452",
      url: "https://www.aesan.gob.es/alertas/2025_39",
      sourceRecordId: "db6e7961-62b1-46db-8f76-d93bcd1a1687",
      code: "general_population"
    },
    {
      reference: "ES2025/455",
      url: "https://www.aesan.gob.es/alertas/2025_40",
      sourceRecordId: "a5c57600-e2b3-426d-9572-032dba013212",
      code: "food_supplements"
    },
    {
      reference: "ES2025/459",
      url: "https://www.aesan.gob.es/alertas/2025_42",
      sourceRecordId: "e64f7218-58ad-4c6e-be6d-a832d25b61dd",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/483",
      url: "https://www.aesan.gob.es/alertas/2025_43",
      sourceRecordId: "ad5e1cbc-1e1e-4c4e-bace-91983fb49935",
      code: "general_population"
    },
    {
      reference: "ES2025/483",
      url: "https://www.aesan.gob.es/alertas/2025_43_Amp",
      sourceRecordId: "c310e03d-ef30-4a77-8a41-aecd31d1cdb1",
      code: "general_population"
    },
    {
      reference: "ES2025/507",
      url: "https://www.aesan.gob.es/alertas/2025_44",
      sourceRecordId: "cdaf1f52-a2b7-433a-b2ee-6bc14325cbf4",
      code: "general_population"
    },
    {
      reference: "ES2025/571",
      url: "https://www.aesan.gob.es/alertas/2025_45",
      sourceRecordId: "d87b2a83-3bc8-4f03-ae3c-ad0a9e6a0164",
      code: "general_population"
    },
    {
      reference: "ES2025/607",
      url: "https://www.aesan.gob.es/alertas/2025_46",
      sourceRecordId: "f6a59722-a1f6-4f9d-9c31-dfd7ad317808",
      code: "general_population"
    },
    {
      reference: "ES2025/608",
      url: "https://www.aesan.gob.es/alertas/2025_47",
      sourceRecordId: "0a7d666c-4411-4f7c-8cd5-a5435c41dbd6",
      code: "general_population"
    },
    {
      reference: "ES2025/615",
      url: "https://www.aesan.gob.es/alertas/2025_48",
      sourceRecordId: "4baf62b5-71af-4db1-9e57-c32c903173e5",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/615",
      url: "https://www.aesan.gob.es/alertas/2025_48_amp",
      sourceRecordId: "379b40db-9d81-4dcd-b2d3-5c946b563556",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/616",
      url: "https://www.aesan.gob.es/alertas/2025_50",
      sourceRecordId: "4055a3c0-6dae-4be6-8893-0deaa977c495",
      code: "general_population"
    },
    {
      reference: "ES2025/618",
      url: "https://www.aesan.gob.es/alertas/2025_49",
      sourceRecordId: "6d76101e-c532-4f4b-a8f7-b406fee32132",
      code: "general_population"
    },
    {
      reference: "ES2025/622",
      url: "https://www.aesan.gob.es/alertas/2025_52",
      sourceRecordId: "2012dfcf-7d64-40e1-aaf8-34190c7d3b18",
      code: "general_population"
    },
    {
      reference: "ES2025/624",
      url: "https://www.aesan.gob.es/alertas/2025_51",
      sourceRecordId: "f9047ec7-50d6-4935-95ce-14b67a3b5e6b",
      code: "general_population"
    },
    {
      reference: "ES2025/627",
      url: "https://www.aesan.gob.es/alertas/2025_54",
      sourceRecordId: "8d9fe638-9404-416c-bc20-646ed6e311de",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/627",
      url: "https://www.aesan.gob.es/alertas/2025_54_amp",
      sourceRecordId: "6109b952-4a47-4985-9534-eec271c759da",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/627",
      url: "https://www.aesan.gob.es/alertas/2025_54_amp2",
      sourceRecordId: "eeacf948-fcbb-48d4-bfe9-615481b623b5",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/627",
      url: "https://www.aesan.gob.es/alertas/2025_54_amp3",
      sourceRecordId: "8c9f32a2-03ac-46c7-92ec-491f5b42af31",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/627",
      url: "https://www.aesan.gob.es/alertas/2025_54_amp4",
      sourceRecordId: "78a7e03c-607b-4be1-8848-1df127dbaa51",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/628",
      url: "https://www.aesan.gob.es/alertas/2025_53",
      sourceRecordId: "fc888fdb-9dff-4ed2-8c79-1ed534295ac9",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/628",
      url: "https://www.aesan.gob.es/alertas/2025_53_Amp",
      sourceRecordId: "33d48c42-54a4-44d0-9b85-85aaee10530f",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/648",
      url: "https://www.aesan.gob.es/alertas/2025_55",
      sourceRecordId: "b6e5d79b-ad76-45f8-ab17-10718f29863a",
      code: "general_population"
    },
    {
      reference: "ES2025/648",
      url: "https://www.aesan.gob.es/alertas/2025_55_Amp",
      sourceRecordId: "f86136bd-cae5-4c81-a0ee-762c0b8f14e9",
      code: "general_population"
    },
    {
      reference: "ES2025/650",
      url: "https://www.aesan.gob.es/alertas/2025_59",
      sourceRecordId: "25ab1081-86a9-4e91-a23f-c821d58ade19",
      code: "general_population"
    },
    {
      reference: "ES2025/658",
      url: "https://www.aesan.gob.es/alertas/2025_56",
      sourceRecordId: "d721085e-ecc0-4190-a643-2ac6643ddf1d",
      code: "general_population"
    },
    {
      reference: "ES2025/658",
      url: "https://www.aesan.gob.es/alertas/2025_56_Correc",
      sourceRecordId: "620f4006-4629-4196-9134-18c973a24b12",
      code: "general_population"
    },
    {
      reference: "ES2025/663",
      url: "https://www.aesan.gob.es/alertas/2025_57",
      sourceRecordId: "a486dbd9-b557-4d31-a210-774681dd2d19",
      code: "general_population"
    },
    {
      reference: "ES2025/664",
      url: "https://www.aesan.gob.es/alertas/2025_58",
      sourceRecordId: "feecdfed-ab25-420d-9ee5-474ec6018a80",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/664",
      url: "https://www.aesan.gob.es/alertas/2025_58_Amp",
      sourceRecordId: "ca47c9c8-66ec-456a-9c4b-aa7e89bda557",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/683",
      url: "https://www.aesan.gob.es/alertas/2025_60",
      sourceRecordId: "4de016cf-0e25-4ea8-a380-71d36b8858c8",
      code: "general_population"
    },
    {
      reference: "ES2025/683",
      url: "https://www.aesan.gob.es/alertas/2025_60_amp",
      sourceRecordId: "e33b5758-4468-4789-851e-eacbccdc440d",
      code: "general_population"
    },
    {
      reference: "ES2025/685",
      url: "https://www.aesan.gob.es/alertas/2025_61",
      sourceRecordId: "ee0900fa-faec-461a-ba72-29194b95d9af",
      code: "general_population"
    },
    {
      reference: "ES2025/692",
      url: "https://www.aesan.gob.es/alertas/2025_62",
      sourceRecordId: "c3c14bd4-17b9-464b-8078-a716108698fb",
      code: "general_population"
    },
    {
      reference: "ES2025/699",
      url: "https://www.aesan.gob.es/alertas/2025_63",
      sourceRecordId: "e43e2099-3b48-4271-b75a-9b24e58f135a",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/723",
      url: "https://www.aesan.gob.es/alertas/2025_64",
      sourceRecordId: "ee87c7d7-39d2-4ed2-8786-0ae553eb56d7",
      code: "general_population"
    },
    {
      reference: "ES2025/723",
      url: "https://www.aesan.gob.es/alertas/2025_64_amp",
      sourceRecordId: "fa0dd8f8-bc51-41b3-8b18-2b8db95fa106",
      code: "general_population"
    },
    {
      reference: "ES2025/727",
      url: "https://www.aesan.gob.es/alertas/2025_66",
      sourceRecordId: "d784ba1a-b400-4574-ba00-5b25bc7675da",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/728",
      url: "https://www.aesan.gob.es/alertas/2025_65",
      sourceRecordId: "5bdc6279-0083-4ebd-9a4f-1adffa940777",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/728",
      url: "https://www.aesan.gob.es/alertas/2025_65_amp",
      sourceRecordId: "21f71533-f098-41c1-989f-4ddedc63aef6",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2025/744",
      url: "https://www.aesan.gob.es/alertas/2025_67",
      sourceRecordId: "754686e0-4397-40b2-bebf-e6c5ccb55250",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/008",
      url: "https://www.aesan.gob.es/alertas/2026_01",
      sourceRecordId: "d18b1902-9384-4ec3-a072-998eeaa1922d",
      code: "general_population"
    },
    {
      reference: "ES2026/017",
      url: "https://www.aesan.gob.es/alertas/2026_02",
      sourceRecordId: "26fc6904-6fe5-4034-afee-e62257892d6d",
      code: "general_population"
    },
    {
      reference: "ES2026/027",
      url: "https://www.aesan.gob.es/alertas/2026_09",
      sourceRecordId: "2accf0ae-85fa-4ea6-b8d2-467fc454fe72",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/039",
      url: "https://www.aesan.gob.es/alertas/2026_03",
      sourceRecordId: "446b665e-deea-4a6b-9df5-898f75661d57",
      code: "general_population"
    },
    {
      reference: "ES2026/043",
      url: "https://www.aesan.gob.es/alertas/2026_04",
      sourceRecordId: "ebf9c88e-a2f3-488e-84c4-f91781e717b6",
      code: "general_population"
    },
    {
      reference: "ES2026/043",
      url: "https://www.aesan.gob.es/alertas/2026_04_amp",
      sourceRecordId: "fe181224-350a-4ea9-a30a-11e1ab7e2909",
      code: "general_population"
    },
    {
      reference: "ES2026/053",
      url: "https://www.aesan.gob.es/alertas/2026_05",
      sourceRecordId: "215284e0-5b28-4a1a-a485-fc267b01b236",
      code: "general_population"
    },
    {
      reference: "ES2026/067",
      url: "https://www.aesan.gob.es/alertas/2026_06",
      sourceRecordId: "dd21905d-ccf5-4bb9-a18a-888b5ea4208d",
      code: "general_population"
    },
    {
      reference: "ES2026/072",
      url: "https://www.aesan.gob.es/alertas/2026_07",
      sourceRecordId: "bd842981-af0f-431e-baca-55c31bf5b8aa",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/074",
      url: "https://www.aesan.gob.es/alertas/2026_08",
      sourceRecordId: "7000c300-e400-448e-98bf-6b3f29da94c2",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/085",
      url: "https://www.aesan.gob.es/alertas/2026_10",
      sourceRecordId: "044c1491-6df9-4ab4-a22c-1e11b0bf1761",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/085",
      url: "https://www.aesan.gob.es/alertas/2026_11",
      sourceRecordId: "683af0bb-f665-4239-a34e-2911bedf5499",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/087",
      url: "https://www.aesan.gob.es/alertas/2026_12",
      sourceRecordId: "c0f33220-9b7b-4b3c-a9d7-aec4539245e4",
      code: "general_population"
    },
    {
      reference: "ES2026/088",
      url: "https://www.aesan.gob.es/alertas/2026_088",
      sourceRecordId: "d6e39e8b-d3c6-479b-b575-d973f1a4ee42",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/089",
      url: "https://www.aesan.gob.es/alertas/2026_13",
      sourceRecordId: "e929f1e3-a624-440f-9fb7-3a1f573ce3a1",
      code: "general_population"
    },
    {
      reference: "ES2026/090",
      url: "https://www.aesan.gob.es/alertas/2026_14",
      sourceRecordId: "dbdb8035-ce5a-4038-82ce-7f71d4dce564",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/090",
      url: "https://www.aesan.gob.es/alertas/2026_14_amp",
      sourceRecordId: "17cca0ff-5b8e-4c96-9ae1-aae72a688f4f",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/090",
      url: "https://www.aesan.gob.es/alertas/2026_19",
      sourceRecordId: "db162721-16c3-4759-b8f1-896d8e40bb40",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/103",
      url: "https://www.aesan.gob.es/alertas/2026_16",
      sourceRecordId: "1eec9047-aa0c-4e76-8664-bf2cf239139d",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/104",
      url: "https://www.aesan.gob.es/alertas/2026_15",
      sourceRecordId: "fa92ab22-d469-4f3c-91b4-f3c84d761b2c",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/118",
      url: "https://www.aesan.gob.es/alertas/2026_22",
      sourceRecordId: "f94cf39a-56d8-4e1c-ae4a-8591d9d7d932",
      code: "general_population"
    },
    {
      reference: "ES2026/126",
      url: "https://www.aesan.gob.es/alertas/2026_17",
      sourceRecordId: "8903c600-42cc-404b-840b-90db1872843a",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/136",
      url: "https://www.aesan.gob.es/alertas/2026_18",
      sourceRecordId: "4f77a243-ab06-4d10-92de-e657d572b8de",
      code: "general_population"
    },
    {
      reference: "ES2026/147",
      url: "https://www.aesan.gob.es/alertas/2026_20",
      sourceRecordId: "97e12c4f-21de-4652-b57c-08b1b97d97a8",
      code: "food_supplements"
    },
    {
      reference: "ES2026/148",
      url: "https://www.aesan.gob.es/alertas/2026_21",
      sourceRecordId: "19900525-14b0-4b53-b6a7-44fe6e0116a8",
      code: "food_supplements"
    },
    {
      reference: "ES2026/160",
      url: "https://www.aesan.gob.es/alertas/2026_23",
      sourceRecordId: "90f47c06-5c85-4e6a-9ad0-dbb2b371a476",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/161",
      url: "https://www.aesan.gob.es/alertas/2026_24",
      sourceRecordId: "d110816b-12ff-413e-ae78-1adab0919e79",
      code: "general_population"
    },
    {
      reference: "ES2026/177",
      url: "https://www.aesan.gob.es/alertas/2026_25",
      sourceRecordId: "39a6bbdf-aeb4-46bd-8f0c-6d9c0c36dce1",
      code: "general_population"
    },
    {
      reference: "ES2026/177",
      url: "https://www.aesan.gob.es/alertas/2026_26",
      sourceRecordId: "6355ea1f-ddff-414b-a0b2-4b324609e90e",
      code: "general_population"
    },
    {
      reference: "ES2026/177",
      url: "https://www.aesan.gob.es/alertas/2026_26_amp",
      sourceRecordId: "6f627cfa-d3cb-46b0-af03-6eaefb2d5742",
      code: "general_population"
    },
    {
      reference: "ES2026/180",
      url: "https://www.aesan.gob.es/alertas/2026_27",
      sourceRecordId: "ba33b5e8-6f9b-4e75-95ef-71e3bd8e81d6",
      code: "general_population"
    },
    {
      reference: "ES2026/181",
      url: "https://www.aesan.gob.es/alertas/2026_28",
      sourceRecordId: "2545ac91-0e15-4845-9081-1d91a774fa62",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/198",
      url: "https://www.aesan.gob.es/alertas/2026_29",
      sourceRecordId: "1f76ccae-5e59-4f87-95fd-59c297b0e36a",
      code: "food_supplements"
    },
    {
      reference: "ES2026/206",
      url: "https://www.aesan.gob.es/alertas/2026_30",
      sourceRecordId: "652a1582-a5bd-4d84-8a7d-cbb75dcb9513",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/208",
      url: "https://www.aesan.gob.es/alertas/2026_31",
      sourceRecordId: "f6a50cd6-24ed-4d43-8ada-23b5bda6d9d0",
      code: "general_population"
    },
    {
      reference: "ES2026/212",
      url: "https://www.aesan.gob.es/alertas/2026_32",
      sourceRecordId: "e1df0a80-45d9-4441-97e6-41e40074de68",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/240",
      url: "https://www.aesan.gob.es/alertas/2026_33",
      sourceRecordId: "1911d820-fa7d-4d9b-8bba-3ec3c81be3d3",
      code: "general_population"
    },
    {
      reference: "ES2026/240",
      url: "https://www.aesan.gob.es/alertas/2026_33_ampliacion",
      sourceRecordId: "751b8df9-7c7a-47ed-8d09-701bb8600cd5",
      code: "general_population"
    },
    {
      reference: "ES2026/240",
      url: "https://www.aesan.gob.es/alertas/2026_33_ampliacion_2",
      sourceRecordId: "2dea65fe-62be-4977-a89e-01f20f9d8b62",
      code: "general_population"
    },
    {
      reference: "ES2026/240",
      url: "https://www.aesan.gob.es/alertas/2026_33_ampliacion_3",
      sourceRecordId: "5fd2bf26-f184-4b19-bdc2-74e08b045716",
      code: "general_population"
    },
    {
      reference: "ES2026/240",
      url: "https://www.aesan.gob.es/alertas/2026_33_ampliacion_4",
      sourceRecordId: "db8db5e4-c740-471a-888e-23b5ead4b2dc",
      code: "general_population"
    },
    {
      reference: "ES2026/240",
      url: "https://www.aesan.gob.es/alertas/2026_33_ampliacion_5",
      sourceRecordId: "152fcad1-5303-474f-9455-d9c47ec581ea",
      code: "general_population"
    },
    {
      reference: "ES2026/240",
      url: "https://www.aesan.gob.es/alertas/2026_33_ampliacion_6",
      sourceRecordId: "2d19880e-23c7-4878-8709-b2e42f99d1a2",
      code: "general_population"
    },
    {
      reference: "ES2026/240",
      url: "https://www.aesan.gob.es/alertas/2026_33_ampliacion_7",
      sourceRecordId: "9f091cca-5364-4355-9de8-62c1a93724e0",
      code: "general_population"
    },
    {
      reference: "ES2026/240",
      url: "https://www.aesan.gob.es/alertas/2026_35",
      sourceRecordId: "6aa2fcfc-5c38-4a2f-943f-ef5e3ac921d0",
      code: "general_population"
    },
    {
      reference: "ES2026/252",
      url: "https://www.aesan.gob.es/alertas/2026_34",
      sourceRecordId: "40a30ad8-bf08-4905-9865-7abcd720bf1d",
      code: "general_population"
    },
    {
      reference: "ES2026/263",
      url: "https://www.aesan.gob.es/alertas/2026_36",
      sourceRecordId: "a0ed5fb2-a519-44d2-90ce-10de58017d81",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/266",
      url: "https://www.aesan.gob.es/alertas/2026_37",
      sourceRecordId: "84fcc8e3-35c5-463a-86ac-c0599fd90e26",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/271",
      url: "https://www.aesan.gob.es/alertas/2026_38",
      sourceRecordId: "90306977-47f3-4435-86ee-ee1a461b500f",
      code: "general_population"
    },
    {
      reference: "ES2026/271",
      url: "https://www.aesan.gob.es/alertas/2026_38_Ampliacion",
      sourceRecordId: "21b4a526-f54e-417c-9465-92e0f8375397",
      code: "general_population"
    },
    {
      reference: "ES2026/271",
      url: "https://www.aesan.gob.es/alertas/2026_38_Ampliacion_2",
      sourceRecordId: "e47500b0-9964-4ec0-93e2-67d6924d850b",
      code: "general_population"
    },
    {
      reference: "ES2026/271",
      url: "https://www.aesan.gob.es/alertas/2026_38_Ampliacion_3",
      sourceRecordId: "4afc87c3-b685-4088-ac26-297aeb3af85a",
      code: "general_population"
    },
    {
      reference: "ES2026/292",
      url: "https://www.aesan.gob.es/alertas/2026_40",
      sourceRecordId: "95d5db3b-4564-46c7-bf89-0f60ac3ffa37",
      code: "food_supplements"
    },
    {
      reference: "ES2026/293",
      url: "https://www.aesan.gob.es/alertas/2026_39",
      sourceRecordId: "91e1b890-ed48-4531-baf7-7d6b995e7070",
      code: "food_supplements"
    },
    {
      reference: "ES2026/300",
      url: "https://www.aesan.gob.es/alertas/2026_44",
      sourceRecordId: "3256c29c-a2a0-4645-9878-b8eb0ed89f73",
      code: "general_population"
    },
    {
      reference: "ES2026/312",
      url: "https://www.aesan.gob.es/alertas/2026_41",
      sourceRecordId: "83a0ac55-57b7-4101-8bcd-751280df9dda",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/322",
      url: "https://www.aesan.gob.es/alertas/2026_42",
      sourceRecordId: "ad1aab7c-4dbc-4fdc-afa0-1f0b6d5bfa56",
      code: "general_population"
    },
    {
      reference: "ES2026/323",
      url: "https://www.aesan.gob.es/alertas/2026_43",
      sourceRecordId: "026714e6-6526-48c0-889b-aeeebefb2eae",
      code: "general_population"
    },
    {
      reference: "ES2026/327",
      url: "https://www.aesan.gob.es/alertas/2026_45",
      sourceRecordId: "1eda1111-cb79-47c3-b745-2892e4b2ac38",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/327",
      url: "https://www.aesan.gob.es/alertas/2026_46_Ampliacion",
      sourceRecordId: "027ab6cc-357d-4a23-8d4b-4694b85ae8b7",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/327",
      url: "https://www.aesan.gob.es/alertas/2026_Ampliacion_45",
      sourceRecordId: "77169d63-23c9-416a-a029-5b834cd64b4e",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/327",
      url: "https://www.aesan.gob.es/alertas/2026_Ampliacion_45_2",
      sourceRecordId: "8d418cf5-2b05-4461-91f6-b113334ba7d2",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/332",
      url: "https://www.aesan.gob.es/alertas/2026_46",
      sourceRecordId: "a7107791-6257-4536-974d-cfba7d9bf485",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/349",
      url: "https://www.aesan.gob.es/alertas/2026_47",
      sourceRecordId: "7b9a6a44-f8e2-4c5c-90c3-978b1068df35",
      code: "general_population"
    },
    {
      reference: "ES2026/350",
      url: "https://www.aesan.gob.es/alertas/2026_48",
      sourceRecordId: "6731932a-8512-4c8d-a055-4c25a19f8769",
      code: "general_population"
    },
    {
      reference: "ES2026/358",
      url: "https://www.aesan.gob.es/alertas/2026_49",
      sourceRecordId: "f1c2820b-472b-4afe-b7b0-87a6cd85eeb6",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/358",
      url: "https://www.aesan.gob.es/alertas/2026_49_Ampliacion_1",
      sourceRecordId: "847d530f-f861-4e60-a7fc-51f5d9d45f22",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/369",
      url: "https://www.aesan.gob.es/alertas/2026_51",
      sourceRecordId: "ff1387af-9abd-4172-b81c-4e2f2c157789",
      code: "general_population"
    },
    {
      reference: "ES2026/370",
      url: "https://www.aesan.gob.es/alertas/2026_50",
      sourceRecordId: "0e9bfbd0-5f25-43ec-b0ae-514bc6959029",
      code: "food_supplements"
    },
    {
      reference: "ES2026/382",
      url: "https://www.aesan.gob.es/alertas/2026_52",
      sourceRecordId: "48dbf3dd-ff5e-4c78-8db9-c8faa724fac9",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/382",
      url: "https://www.aesan.gob.es/alertas/2026_52_Ampliacion_1",
      sourceRecordId: "23120d22-6a40-4231-8d70-ff5a7f0660be",
      code: null
    },
    {
      reference: "ES2026/406",
      url: "https://www.aesan.gob.es/alertas/2026_53",
      sourceRecordId: "1610b5be-8723-4930-8c7d-863e0179ffc9",
      code: "general_population"
    },
    {
      reference: "ES2026/431",
      url: "https://www.aesan.gob.es/alertas/2026_54",
      sourceRecordId: "77610767-b7fd-40e1-ad61-91b7e6c4a6c8",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/469",
      url: "https://www.aesan.gob.es/alertas/2026_55",
      sourceRecordId: "bfda8d94-9b31-45ff-ac69-57b3d64b5126",
      code: "general_population"
    },
    {
      reference: "ES2026/469",
      url: "https://www.aesan.gob.es/alertas/2026_55_ampliacion_1",
      sourceRecordId: "48d36ff3-a623-42d9-a111-dcaaa99bc107",
      code: "general_population"
    },
    {
      reference: "ES2026/473",
      url: "https://www.aesan.gob.es/alertas/2026_56",
      sourceRecordId: "a6958f51-c125-49ad-b470-917844b47f10",
      code: "general_population"
    },
    {
      reference: "ES2026/477",
      url: "https://www.aesan.gob.es/alertas/2026_57",
      sourceRecordId: "98368761-4c68-4b51-8844-55245edfbade",
      code: "general_population"
    },
    {
      reference: "ES2026/478",
      url: "https://www.aesan.gob.es/alertas/2026_63",
      sourceRecordId: "bba745c0-3f3b-4322-a67e-d566d4ace8a0",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/481",
      url: "https://www.aesan.gob.es/alertas/2026_59",
      sourceRecordId: "1b9b43d2-1832-4eb5-9514-3b9110900651",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/482",
      url: "https://www.aesan.gob.es/alertas/2026_61",
      sourceRecordId: "564bba35-cece-4299-9883-ef5f5a3656d4",
      code: "general_population"
    },
    {
      reference: "ES2026/485",
      url: "https://www.aesan.gob.es/alertas/2026_62",
      sourceRecordId: "979d3e75-36ce-450f-9c91-addb394e765d",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/517",
      url: "https://www.aesan.gob.es/alertas/2026_65",
      sourceRecordId: "4e2180c9-e75b-4583-af9e-1ecfdda918df",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/517",
      url: "https://www.aesan.gob.es/alertas/2026_65_rev",
      sourceRecordId: "f15fbfe8-aa09-4203-b932-6700decbe1d8",
      code: "allergy_intolerance_adverse"
    },
    {
      reference: "ES2026/535",
      url: "https://www.aesan.gob.es/alertas/2026_66",
      sourceRecordId: "026831a7-0144-4b59-a6f2-757725e1640b",
      code: "food_supplements"
    },
    {
      reference: "ES2026/543",
      url: "https://www.aesan.gob.es/alertas/2026_67",
      sourceRecordId: "60ab5444-518c-4084-b2aa-e00541270e58",
      code: "food_supplements"
    }
  ]
};

// candidate-probe-v4-src/lib/aesan-native.ts
function aesanProducerSeed(alert) {
  const record7 = alert.canonical.sourceRecord;
  const evidence = aesanPublicationEvidence(alert.canonical);
  const states = evidence?.publications.flatMap((x) => x.states) ?? [];
  const sourceRecordId = record7.revisionSourceRecordId ?? record7.sourceRecordId;
  return {
    ...alert,
    ...record7,
    source: "AESAN",
    type: "Alimentaria",
    id: alert.id,
    sourceRecordId,
    contentHash: record7.sourceRecordHash,
    detectedAt: alert.detectedAt,
    updatedAt: alert.updatedAt,
    isUpdate: alert.isUpdate,
    ...states.length > 1 ? { publicationHistory: states } : {},
    ...evidence?.selection.status === "parallel_publications" ? { publicationSelection: evidence.selection } : {}
  };
}
async function fetchNativeAesanAlerts(store, fetchImpl, fullHistory = false) {
  if (!store.readAesanProducerSeed) throw Error("AESAN_NATIVE seed reader unavailable");
  const prior = await store.readAesanProducerSeed();
  if (prior.length >= 5e3) throw Error("AESAN_NATIVE seed truncated");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let htmlCharacters = 0;
  const produced = await produceAesanRecent({
    previousAlerts: prior.map(aesanProducerSeed),
    now,
    reviewed: reviewed_default.publications,
    fullHistory,
    fetchHtml: async (url) => {
      const target = new URL(url);
      if (target.origin !== "https://www.aesan.gob.es" || !target.pathname.startsWith("/alertas/") || target.username || target.password) throw Error("AESAN_NATIVE nonofficial URL");
      const response = await fetchImpl(target, { headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "NagameAlert-AESAN/2.0" }, redirect: "manual", signal: AbortSignal.timeout(3e4), cache: "no-store" });
      if (!response.ok) throw Error("AESAN_NATIVE HTTP " + response.status);
      const body = await response.text();
      htmlCharacters += body.length;
      if (body.length > 2e6 || htmlCharacters > 16e6 || !/<html|<!doctype/iu.test(body)) throw Error("AESAN_NATIVE invalid HTML or memory budget");
      return body;
    }
  });
  const alerts2 = await Promise.all(produced.alerts.map(normalizeAesanFeedAlert));
  if (!alerts2.length || alerts2.some((x) => x === null)) throw Error("AESAN_NATIVE incomplete normalized batch");
  return alerts2;
}

// candidate-probe-v4-src/lib/aesan-sync.ts
var nowIso = (options) => (options.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
var emptyState = (at, mode = "recent") => ({
  source: "AESAN",
  mode,
  status: "idle",
  cursor: 0,
  totalUnits: 0,
  pagesScanned: 0,
  recordsObserved: 0,
  recordsPersisted: 0,
  newCount: 0,
  updatedCount: 0,
  detailFailures: 0,
  pageErrors: 0,
  oldestPublishedAt: null,
  newestPublishedAt: null,
  coverage: "unknown",
  startedAt: null,
  lastSuccessAt: null,
  completedAt: null,
  lastError: null,
  leaseOwnerId: null,
  leaseMode: null,
  leaseExpiresAt: null,
  lastSkippedAt: null,
  lastSkipReason: null,
  lastSkippedOwnerId: null,
  updatedAt: at
});
var errorMessage = (error) => error instanceof Error ? error.message : "Error de sincronizaci\xF3n AESAN no identificado";
var isOfficialAesanUrl2 = (value) => {
  try {
    const url = new URL(value);
    const officialHost = url.hostname === "aesan.gob.es" || url.hostname.endsWith(".aesan.gob.es");
    const currentAlert = /^\/alertas\/(?!buscador-alertas(?:\/|$)|alertas-alimentarias(?:\/|$))[^/?#]+/iu.test(url.pathname);
    const legacyAlert = /^\/AECOSAN\/web\/seguridad_alimentaria\/(?:alertas_alimentarias|ampliacion)\/(?!listado\/)[^/?#]+\.htm$/iu.test(url.pathname);
    return url.protocol === "https:" && officialHost && (currentAlert || legacyAlert);
  } catch {
    return false;
  }
};
var timestamp = (value) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
var sameAesanEntity = (current, incoming) => current.source === "AESAN" && incoming.source === "AESAN" && current.id === incoming.id && current.reference === incoming.reference;
var isMonotonicDowngrade = (current, incoming) => {
  if (!sameAesanEntity(current, incoming)) return false;
  const before = timestamp(current.publishedAt);
  const after = timestamp(incoming.publishedAt);
  if (before !== null && after !== null && after < before) return true;
  return before === after && current.isUpdate && !incoming.isUpdate;
};
var isVerifiedOfficialRevision = (current, incoming) => {
  if (!sameAesanEntity(current, incoming) || !incoming.isUpdate || incoming.canonical.lifecycle.officialUpdate.normalized !== true) return false;
  if (!isOfficialAesanUrl2(current.url) || !isOfficialAesanUrl2(incoming.url) || current.url === incoming.url) return false;
  const before = timestamp(current.publishedAt);
  const after = timestamp(incoming.publishedAt);
  if (before === null || after === null || after <= before) return false;
  const schemaVersion = incoming.canonical.sourceRecord?.sourceRecordSchemaVersion;
  const sourceRecordHash = incoming.canonical.sourceRecord?.sourceRecordHash;
  return schemaVersion === 2 && typeof sourceRecordHash === "string" && /^[0-9a-f]{64}$/u.test(sourceRecordHash);
};
var sourceRecordString = (alert, key) => {
  const value = alert.canonical.sourceRecord?.[key];
  return typeof value === "string" ? value.trim() : "";
};
var publicationIdentity = (alert) => {
  const revisionId = sourceRecordString(alert, "revisionSourceRecordId");
  const sourceRecordId = alert.isUpdate && revisionId ? revisionId : alert.canonical.identity.sourceRecordId.trim();
  const sourceRecordHash = sourceRecordString(alert, "sourceRecordHash");
  if (!sourceRecordId || !sourceRecordHash || !/^[0-9a-f]{64}$/u.test(sourceRecordHash) || !isOfficialAesanUrl2(alert.url)) return null;
  return {
    sourceRecordId,
    officialUrl: alert.url,
    reference: alert.reference,
    publishedAt: alert.publishedAt,
    officialUpdatedAt: alert.canonical.dates.officialUpdatedAt.normalized,
    isUpdate: alert.isUpdate,
    title: alert.title,
    sourceRecordHash
  };
};
var parsedPublicationHistory = (alert) => {
  const values = alert.canonical.sourceRecord?.publicationHistory;
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const item = value;
    const sourceRecordId = typeof item.sourceRecordId === "string" ? item.sourceRecordId.trim() : "";
    const officialUrl2 = typeof item.officialUrl === "string" ? item.officialUrl.trim() : "";
    const reference = typeof item.reference === "string" ? item.reference.trim() : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const sourceRecordHash = typeof item.sourceRecordHash === "string" ? item.sourceRecordHash.trim() : "";
    const publishedAt = item.publishedAt === null || typeof item.publishedAt === "string" ? item.publishedAt : null;
    const officialUpdatedAt = item.officialUpdatedAt === null || typeof item.officialUpdatedAt === "string" ? item.officialUpdatedAt : null;
    if (!sourceRecordId || !officialUrl2 || !reference || !title || !/^[0-9a-f]{64}$/u.test(sourceRecordHash) || !isOfficialAesanUrl2(officialUrl2) || typeof item.isUpdate !== "boolean") return [];
    return [{
      sourceRecordId,
      officialUrl: officialUrl2,
      reference,
      publishedAt,
      officialUpdatedAt,
      isUpdate: item.isUpdate,
      title,
      sourceRecordHash
    }];
  });
};
var publicationHistory = (current, incoming) => {
  const values = [...parsedPublicationHistory(current), publicationIdentity(current), publicationIdentity(incoming)].filter((value) => Boolean(value));
  const byIdentity = /* @__PURE__ */ new Map();
  for (const value of values) {
    const prior = byIdentity.get(value.sourceRecordId);
    if (prior && (prior.officialUrl !== value.officialUrl || prior.reference !== value.reference)) {
      throw new Error(`AESAN publication identity conflict for ${value.sourceRecordId}`);
    }
    byIdentity.set(value.sourceRecordId, value);
  }
  return [...byIdentity.values()].sort((left, right) => (left.publishedAt ?? "").localeCompare(right.publishedAt ?? "") || left.officialUrl.localeCompare(right.officialUrl, "en"));
};
var hasExpectedAesanSchema = (alert) => {
  const sourceRecordId = alert.canonical.identity.sourceRecordId.trim();
  const publishedAt = alert.canonical.dates.publishedAt.normalized;
  return alert.source === "AESAN" && alert.canonical.identity.source === "AESAN" && alert.canonical.identity.internalId === alert.id && alert.canonical.identity.officialReference === alert.reference && alert.canonical.identity.officialUrl === alert.url && sourceRecordId.length > 0 && sourceRecordString(alert, "sourceRecordId") === sourceRecordId && alert.canonical.sourceRecord?.sourceRecordSchemaVersion === 2 && /^[0-9a-f]{64}$/u.test(sourceRecordString(alert, "sourceRecordHash")) && publishedAt === alert.publishedAt && alert.canonical.lifecycle.officialUpdate.normalized === alert.isUpdate;
};
var evidenceForAlert = (alert, evidence) => {
  const identity2 = publicationIdentity(alert);
  if (!identity2) return null;
  const member = {
    sourceRecordId: identity2.sourceRecordId,
    url: identity2.officialUrl,
    sourceRecordHash: identity2.sourceRecordHash
  };
  const publication = evidence.publications.find(({ sourceRecordId, url }) => sourceRecordId === member.sourceRecordId && url === member.url);
  if (!publication?.states.some(({ sourceRecordHash }) => sourceRecordHash === member.sourceRecordHash)) return null;
  const parallelMember = evidence.selection.status === "parallel_publications" && evidence.selection.members.some((candidate) => candidate.sourceRecordId === member.sourceRecordId && candidate.url === member.url && candidate.sourceRecordHash === member.sourceRecordHash);
  return selectAesanPublicationEvidence(evidence, parallelMember ? evidence.selection : {
    status: "current_publication",
    basis: "feed_current",
    chronological: true,
    anchorSourceRecordId: member.sourceRecordId,
    members: [member]
  });
};
var evidenceFromAcceptedMaterial = async (alert) => {
  const identity2 = publicationIdentity(alert);
  const material = aesanPublishedRecord(alert.canonical);
  const sourceRecordIdType = alert.canonical.sourceRecord?.sourceRecordIdType;
  if (!identity2 || !material || !hasExpectedAesanSchema(alert) || sourceRecordIdType !== "idAlert" && sourceRecordIdType !== "official_page_path") return null;
  return createAesanPublicationEvidenceFromMaterial({
    ...material,
    reference: identity2.reference,
    sourceRecordId: identity2.sourceRecordId,
    sourceRecordIdType,
    url: identity2.officialUrl,
    publishedAt: identity2.publishedAt
  });
};
var mergeEvidenceForAcceptedAlert = async (accepted, ...candidates) => {
  const available = candidates.filter((candidate) => Boolean(candidate));
  if (!available.length) return null;
  const acceptedEvidence = await evidenceFromAcceptedMaterial(accepted);
  if (!acceptedEvidence) {
    throw new Error(`AESAN publication evidence cannot be aligned to accepted record ${accepted.id}`);
  }
  let merged = acceptedEvidence;
  for (const candidate of available) {
    merged = mergeAesanPublicationEvidence(merged, candidate);
  }
  const identity2 = publicationIdentity(accepted);
  const parallel = available.find((candidate) => candidate.selection.status === "parallel_publications" && candidate.selection.members.some((member) => member.sourceRecordId === identity2.sourceRecordId && member.url === identity2.officialUrl && member.sourceRecordHash === identity2.sourceRecordHash));
  return parallel ? selectAesanPublicationEvidence(merged, parallel.selection) : evidenceForAlert(accepted, merged);
};
var projectAesanRevision = async (current, incoming) => {
  const currentSourceRecordId = current.canonical.identity.sourceRecordId.trim();
  const incomingSourceRecordId = incoming.canonical.identity.sourceRecordId.trim();
  const currentEvidence = aesanPublicationEvidence(current.canonical);
  const incomingEvidence = aesanPublicationEvidence(incoming.canonical);
  const publicationEvidence = await mergeEvidenceForAcceptedAlert(incoming, incomingEvidence, currentEvidence);
  const canonical = {
    ...incoming.canonical,
    identity: {
      ...incoming.canonical.identity,
      internalId: current.id,
      sourceRecordId: currentSourceRecordId
    },
    dates: { ...incoming.canonical.dates, detectedAt: current.detectedAt },
    sourceRecord: {
      ...incoming.canonical.sourceRecord,
      sourceRecordId: currentSourceRecordId,
      lineageSourceRecordId: currentSourceRecordId,
      revisionSourceRecordId: incomingSourceRecordId,
      publicationHistory: publicationHistory(current, incoming),
      ...publicationEvidence ? { aesanPublicationEvidence: publicationEvidence } : {}
    }
  };
  return { canonical, contentHash: await canonicalContentHash(canonical) };
};
var mergeAesanPublicationEvidenceInto = async (preferred, additional) => {
  const additionalEvidence = aesanPublicationEvidence(additional.canonical);
  const preferredEvidence = aesanPublicationEvidence(preferred.canonical);
  const evidence = await mergeEvidenceForAcceptedAlert(preferred, preferredEvidence, additionalEvidence);
  if (!evidence) return preferred;
  return {
    ...preferred,
    canonical: {
      ...preferred.canonical,
      sourceRecord: { ...preferred.canonical.sourceRecord, aesanPublicationEvidence: evidence }
    }
  };
};
var isRegisteredAesanRevision = (current, incoming) => {
  const currentSourceRecordId = current.canonical.identity.sourceRecordId.trim();
  const incomingSourceRecordId = incoming.canonical.identity.sourceRecordId.trim();
  return sameAesanEntity(current, incoming) && current.isUpdate && incoming.isUpdate && current.canonical.lifecycle.officialUpdate.normalized === true && incoming.canonical.lifecycle.officialUpdate.normalized === true && hasExpectedAesanSchema(current) && hasExpectedAesanSchema(incoming) && isOfficialAesanUrl2(current.url) && current.url === incoming.url && current.publishedAt === incoming.publishedAt && current.canonical.sourceRecord.lineageSourceRecordId === currentSourceRecordId && sourceRecordString(current, "revisionSourceRecordId") === incomingSourceRecordId;
};
async function reconcileAesanRevisionIdentityInternal(current, incoming) {
  if (!current || !sameAesanEntity(current, incoming)) return incoming;
  if (isMonotonicDowngrade(current, incoming)) {
    const currentDate = timestamp(current.publishedAt);
    const incomingDate = timestamp(incoming.publishedAt);
    const verifiedInvertedOrder = current.isUpdate && !incoming.isUpdate && current.canonical.identity.sourceRecordId !== incoming.canonical.identity.sourceRecordId && current.canonical.lifecycle.officialUpdate.normalized === true && incoming.canonical.lifecycle.officialUpdate.normalized === false && hasExpectedAesanSchema(current) && hasExpectedAesanSchema(incoming) && isOfficialAesanUrl2(current.url) && isOfficialAesanUrl2(incoming.url) && current.url !== incoming.url && currentDate !== null && incomingDate !== null && incomingDate < currentDate;
    if (!verifiedInvertedOrder) return mergeAesanPublicationEvidenceInto(current, incoming);
    const { canonical: canonical2, contentHash: contentHash2 } = await projectAesanRevision(incoming, current);
    return { ...current, detectedAt: incoming.detectedAt, canonical: canonical2, contentHash: contentHash2 };
  }
  const currentSourceRecordId = current.canonical.identity.sourceRecordId.trim();
  const incomingSourceRecordId = incoming.canonical.identity.sourceRecordId.trim();
  if (!currentSourceRecordId || !incomingSourceRecordId) return incoming;
  if (currentSourceRecordId === incomingSourceRecordId) return mergeAesanPublicationEvidenceInto(incoming, current);
  const registeredRevision = isRegisteredAesanRevision(current, incoming);
  if (!registeredRevision && !isVerifiedOfficialRevision(current, incoming)) return incoming;
  const { canonical, contentHash } = await projectAesanRevision(current, incoming);
  if (registeredRevision && contentHash === current.contentHash) {
    return {
      ...incoming,
      id: current.id,
      detectedAt: current.detectedAt,
      updatedAt: current.updatedAt,
      versionCount: current.versionCount,
      canonical,
      contentHash: current.contentHash
    };
  }
  return {
    ...incoming,
    id: current.id,
    detectedAt: current.detectedAt,
    canonical,
    contentHash
  };
}
async function reconcileAesanRevisionIdentity(current, incoming) {
  const result = await reconcileAesanRevisionIdentityInternal(current, incoming);
  const sourceRecord = result.canonical.sourceRecord;
  if (Object.hasOwn(sourceRecord, "aesanAlertClassification")) {
    const sourceRecordIdType = sourceRecord.sourceRecordIdType;
    const sourceRecordId = sourceRecord.revisionSourceRecordId ?? result.canonical.identity.sourceRecordId;
    parseAesanAlertClassification(
      sourceRecord.aesanAlertClassification,
      [{
        sourceRecordId,
        sourceRecordIdType,
        url: result.url
      }],
      aesanPublicationEvidence(result.canonical)
    );
  }
  return result;
}
async function selectAesanReconciliationStates(store, alerts2) {
  if (!store.readAlertReconciliationCandidates) {
    throw new Error("AlertStore no dispone de lectura dirigida para reconciliaci\xF3n AESAN");
  }
  const ids = [...new Set(alerts2.map((alert) => alert.id.trim()).filter(Boolean))];
  const references = [...new Set(alerts2.map((alert) => alert.reference.trim()).filter(Boolean))];
  const candidates = await store.readAlertReconciliationCandidates("AESAN", ids, references);
  const seenCandidateIds = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    if (candidate.alert.source !== "AESAN") {
      throw new Error(`AESAN reconciliation lookup returned source ${candidate.alert.source}`);
    }
    if (seenCandidateIds.has(candidate.alert.id)) {
      throw new Error(`AESAN reconciliation lookup returned duplicate candidate ${candidate.alert.id}`);
    }
    seenCandidateIds.add(candidate.alert.id);
  }
  return alerts2.map((alert) => {
    const matches = candidates.filter((candidate) => candidate.matchedIds.includes(alert.id) || candidate.matchedReferences.includes(alert.reference));
    if (matches.length > 1) {
      throw new Error(
        `AESAN reconciliation conflict for ${alert.id}/${alert.reference}: ` + matches.map((candidate) => candidate.alert.id).sort().join(", ")
      );
    }
    return { current: matches[0]?.alert ?? null, incoming: alert };
  });
}
async function reconcileAesanBatch(store, alerts2) {
  const selected = await selectAesanReconciliationStates(store, alerts2);
  return await Promise.all(selected.map(({ current, incoming }) => reconcileAesanRevisionIdentity(current, incoming)));
}
async function runAesanFeedSync(store, options = {}) {
  if (!store.readSyncState || !store.writeSyncState) throw new Error("AlertStore no dispone de estado de sincronizaci\xF3n");
  const readState = store.readSyncState.bind(store);
  const writeState = store.writeSyncState.bind(store);
  const mode = options.mode ?? "recent";
  const lease = await acquireSourceLease(store, "AESAN", mode, options);
  const at = nowIso(options);
  if (!lease.acquired) {
    const previous = await readState("AESAN", mode) ?? emptyState(at, mode);
    await store.recordSyncSkip?.("AESAN", mode, lease.ownerId, at, "already-running");
    return {
      ...previous,
      status: "skipped",
      leaseOwnerId: lease.lease.ownerId,
      leaseMode: lease.lease.mode,
      leaseExpiresAt: lease.lease.expiresAt,
      lastSkippedAt: at,
      lastSkipReason: "already-running",
      lastSkippedOwnerId: lease.ownerId,
      updatedAt: at
    };
  }
  try {
    const previous = await readState("AESAN", mode) ?? emptyState(at, mode);
    const running = {
      ...previous,
      status: "running",
      cursor: 0,
      totalUnits: 1,
      pagesScanned: 0,
      recordsObserved: 0,
      recordsPersisted: 0,
      newCount: 0,
      updatedCount: 0,
      detailFailures: 0,
      pageErrors: 0,
      oldestPublishedAt: null,
      newestPublishedAt: null,
      coverage: mode === "historical-reconcile" ? "official-index-complete" : "partial",
      startedAt: at,
      completedAt: null,
      lastError: null,
      leaseOwnerId: lease.ownerId,
      leaseMode: mode,
      leaseExpiresAt: lease.lease.expiresAt,
      updatedAt: at
    };
    await writeState(running);
    try {
      const fetched = await (options.fetchAlerts ?? fetchAesanAlerts)();
      const alerts2 = await reconcileAesanBatch(store, fetched);
      const renewed = await lease.renew();
      running.leaseExpiresAt = renewed.expiresAt;
      running.updatedAt = renewed.heartbeatAt;
      await writeState(running);
      const persisted = await store.persistSuccess("AESAN", alerts2, { ownerId: lease.ownerId, now: () => nowIso(options) });
      await lease.renew();
      const completedAt = nowIso(options);
      const published = alerts2.map((alert) => alert.publishedAt).filter((value) => Boolean(value)).sort();
      const state = {
        ...running,
        status: "completed",
        cursor: 1,
        pagesScanned: 1,
        recordsObserved: alerts2.length,
        recordsPersisted: (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
        newCount: persisted.newCount ?? 0,
        updatedCount: persisted.updatedCount ?? 0,
        oldestPublishedAt: published[0] ?? null,
        newestPublishedAt: published.at(-1) ?? null,
        lastSuccessAt: completedAt,
        completedAt,
        leaseOwnerId: null,
        leaseMode: null,
        leaseExpiresAt: null,
        updatedAt: completedAt
      };
      await writeState(state);
      return state;
    } catch (error) {
      const failedAt = nowIso(options);
      const state = {
        ...running,
        status: "failed",
        pageErrors: 1,
        lastError: errorMessage(error),
        leaseOwnerId: null,
        leaseMode: null,
        leaseExpiresAt: null,
        updatedAt: failedAt
      };
      if (!(error instanceof SyncLeaseLostError)) {
        try {
          await store.persistFailure("AESAN", error, { ownerId: lease.ownerId, now: () => nowIso(options) });
        } catch {
        }
        await writeState(state);
      }
      return state;
    }
  } finally {
    await lease.release();
  }
}

// candidate-probe-v4-src/lib/rapna-sync.ts
var nowIso2 = (options = {}) => (options.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
var errorMessage2 = (error) => error instanceof Error ? error.message : "Error de sincronizaci\xF3n RAPNA no identificado";
var minDate2 = (current, candidate) => !candidate ? current : !current || candidate < current ? candidate : current;
var maxDate2 = (current, candidate) => !candidate ? current : !current || candidate > current ? candidate : current;
var currentUnitKey = (unit) => `current:${unit.year}`;
var currentParityPlanVersion = async (at, plan) => `rapna-current-parity-v1:${at.slice(0, 10)}:${await sha256(plan)}`;
async function runRapnaCurrentParity(store, batchSize = 6, client = {}, options = {}) {
  const sync = requireSyncState(store);
  const lease = await acquireSourceLease(store, "RAPNA", "current-parity", options);
  if (!lease.acquired) return skippedState(store, "current-parity", lease.ownerId, lease.lease, options);
  try {
    const startedAt = nowIso2(options);
    const plan = await fetchRapnaCurrentReplayPlan(client);
    if (plan.some((unit) => unit.archive !== "current")) throw new Error("El plan diario RAPNA contiene una unidad no CURRENT");
    const planVersion = await currentParityPlanVersion(startedAt, plan);
    const stored = await sync.read("RAPNA", "current-parity");
    const previous = stored?.planVersion === planVersion ? stored : emptyState2("current-parity", startedAt);
    if (previous.status === "completed" && previous.coverage === "official-index-complete") return previous;
    let running = {
      ...previous,
      status: "running",
      planVersion,
      totalUnits: plan.length,
      coverage: previous.cursor ? "partial" : "unknown",
      startedAt: previous.startedAt ?? startedAt,
      completedAt: null,
      lastError: null,
      leaseOwnerId: lease.ownerId,
      leaseMode: "current-parity",
      leaseExpiresAt: lease.lease.expiresAt,
      updatedAt: startedAt
    };
    await sync.write(running);
    const selected = plan.slice(running.cursor, running.cursor + Math.max(1, Math.min(6, Math.trunc(batchSize))));
    for (const unit of selected) {
      try {
        const fetched = await fetchRapnaBackfillUnit(unit, client, startedAt);
        if (fetched.invalidRecords || fetched.alerts.some((alert) => alert.canonical.sourceRecord.archive !== "current")) {
          throw new Error(`La unidad ${currentUnitKey(unit)} no pudo certificarse como CURRENT completa`);
        }
        await lease.renew();
        const persisted = await store.persistSuccess("RAPNA", fetched.alerts, { ownerId: lease.ownerId, now: () => nowIso2(options) });
        const renewed = await lease.renew();
        const nextCursor = running.cursor + 1;
        const at2 = nowIso2(options);
        running = {
          ...running,
          status: nextCursor >= plan.length ? "completed" : "partial",
          cursor: nextCursor,
          cursorKey: currentUnitKey(unit),
          pagesScanned: running.pagesScanned + fetched.pagesScanned,
          recordsObserved: running.recordsObserved + fetched.recordsObserved,
          recordsPersisted: running.recordsPersisted + (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
          newCount: running.newCount + (persisted.newCount ?? 0),
          updatedCount: running.updatedCount + (persisted.updatedCount ?? 0),
          oldestPublishedAt: minDate2(running.oldestPublishedAt, fetched.oldestPublishedAt),
          newestPublishedAt: maxDate2(running.newestPublishedAt, fetched.newestPublishedAt),
          coverage: nextCursor >= plan.length ? "official-index-complete" : "partial",
          lastSuccessAt: at2,
          completedAt: nextCursor >= plan.length ? at2 : null,
          leaseExpiresAt: renewed.expiresAt,
          updatedAt: at2
        };
        await sync.write(running);
      } catch (error) {
        const at2 = nowIso2(options);
        const failed = {
          ...running,
          status: "partial",
          pageErrors: running.pageErrors + 1,
          lastError: errorMessage2(error),
          leaseOwnerId: null,
          leaseMode: null,
          leaseExpiresAt: null,
          updatedAt: at2
        };
        if (!(error instanceof SyncLeaseLostError)) await sync.write(failed);
        return failed;
      }
    }
    const at = nowIso2(options);
    const finalState = { ...running, leaseOwnerId: null, leaseMode: null, leaseExpiresAt: null, updatedAt: at };
    await sync.write(finalState);
    return finalState;
  } finally {
    await lease.release();
  }
}
var legacyUnitKey = (unit) => `legacy:${unit.year}`;
var legacyReconcilePlanVersion = (at, digest2) => `rapna-legacy-reconcile-v2:${at.slice(0, 10)}:${digest2}`;
var parseLegacyReconcilePlanVersion = (value) => {
  const match = value?.match(/^rapna-legacy-reconcile-v(?:1|2):(\d{4}-\d{2}-\d{2}):([0-9a-f]{64})$/u);
  return match ? { cycleDate: match[1], digest: match[2] } : null;
};
async function runRapnaLegacyReconcile(store, batchSize = 3, client = {}, options = {}) {
  const syncState3 = requireSyncState(store);
  const lease = await acquireSourceLease(store, "RAPNA", "legacy-reconcile", options);
  if (!lease.acquired) return skippedState(store, "legacy-reconcile", lease.ownerId, lease.lease, options);
  try {
    const startedAt = nowIso2(options);
    const plan = await fetchRapnaLegacyRevisionPlan(client);
    if (!plan.length || plan.some((unit) => unit.archive !== "legacy")) {
      throw new Error("El plan RAPNA LEGACY no contiene exclusivamente unidades LEGACY");
    }
    const planDigest = await sha256(plan);
    const nextPlanVersion = legacyReconcilePlanVersion(startedAt, planDigest);
    const storedState = await syncState3.read("RAPNA", "legacy-reconcile");
    const storedVersion = parseLegacyReconcilePlanVersion(storedState?.planVersion);
    let previous;
    let planVersion = nextPlanVersion;
    if (storedState?.planVersion && storedState.status === "completed" && storedState.coverage === "official-index-complete" && storedVersion?.digest === planDigest && storedVersion.cycleDate === startedAt.slice(0, 10)) {
      return storedState;
    }
    if (storedState?.planVersion && storedState.status !== "completed") {
      if (storedVersion?.digest === planDigest) {
        previous = storedState;
        planVersion = storedState.planVersion;
      } else if (storedState.status === "failed") {
        previous = emptyState2("legacy-reconcile", startedAt);
      } else {
        const at2 = nowIso2(options);
        const failed = {
          ...storedState,
          status: "failed",
          lastError: "El plan RAPNA LEGACY cambi\xF3 durante un ciclo en curso; el ciclo se detuvo sin reiniciar el cursor",
          leaseOwnerId: null,
          leaseMode: null,
          leaseExpiresAt: null,
          updatedAt: at2
        };
        await syncState3.write(failed);
        return failed;
      }
    } else {
      previous = emptyState2("legacy-reconcile", startedAt);
    }
    const expectedCursorKey = previous.cursor > 0 ? legacyUnitKey(plan[previous.cursor - 1]) : null;
    if (previous.cursor < 0 || previous.cursor > plan.length || (previous.cursorKey ?? null) !== expectedCursorKey) {
      const at2 = nowIso2(options);
      const failed = {
        ...previous,
        status: "failed",
        planVersion,
        totalUnits: plan.length,
        lastError: "El cursor RAPNA LEGACY no coincide con el plan persistido",
        leaseOwnerId: null,
        leaseMode: null,
        leaseExpiresAt: null,
        updatedAt: at2
      };
      await syncState3.write(failed);
      return failed;
    }
    if (!store.readAlertsByReferences) throw new Error("AlertStore no soporta la protecci\xF3n de identidad RAPNA LEGACY");
    let running = {
      ...previous,
      status: "running",
      planVersion,
      totalUnits: plan.length,
      coverage: previous.cursor ? "partial" : "unknown",
      startedAt: previous.startedAt ?? startedAt,
      completedAt: null,
      lastError: null,
      leaseOwnerId: lease.ownerId,
      leaseMode: "legacy-reconcile",
      leaseExpiresAt: lease.lease.expiresAt,
      updatedAt: startedAt
    };
    await syncState3.write(running);
    const selected = plan.slice(running.cursor, running.cursor + Math.max(1, Math.min(3, Math.trunc(batchSize))));
    for (const unit of selected) {
      try {
        const fetched = await fetchRapnaBackfillUnit(unit, client, startedAt);
        if (fetched.invalidRecords || fetched.alerts.some((alert) => alert.canonical.sourceRecord.archive !== "legacy")) {
          throw new Error(`La unidad ${legacyUnitKey(unit)} no pudo certificarse como LEGACY completa`);
        }
        if (fetched.alerts.length + fetched.duplicateRecords !== fetched.recordsObserved) {
          throw new Error(`La unidad ${legacyUnitKey(unit)} no conserva la contabilidad raw/\xFAnica de RAPNA LEGACY`);
        }
        const duplicateReferences = new Set(fetched.duplicateReferences);
        const operationalDuplicates = fetched.alerts.filter((alert) => duplicateReferences.has(alert.reference) && classifyOperationalCoverage(alert) !== "archive").map((alert) => alert.reference).sort((left, right) => left.localeCompare(right, "es", { numeric: true }));
        if (operationalDuplicates.length) {
          throw new Error(`RAPNA LEGACY contiene identidades duplicadas dentro del alcance operativo: ${operationalDuplicates.slice(0, 20).join(", ")}`);
        }
        const existing = await store.readAlertsByReferences("RAPNA", fetched.alerts.map((alert) => alert.reference));
        const currentCollisions = existing.filter((alert) => alert.canonical.sourceRecord.archive === "current").map((alert) => alert.reference).sort();
        if (currentCollisions.length) {
          throw new Error(`RAPNA LEGACY colisiona con CURRENT: ${currentCollisions.slice(0, 20).join(", ")}`);
        }
        const crossYearLegacy = existing.flatMap((alert) => {
          if (alert.canonical.sourceRecord.archive !== "legacy") return [];
          const raw = alert.canonical.sourceRecord.record;
          const storedYear = raw && typeof raw === "object" && !Array.isArray(raw) ? Number(raw.ano) : NaN;
          return Number.isSafeInteger(storedYear) && storedYear !== unit.year ? [alert.reference] : [];
        }).sort();
        if (crossYearLegacy.length) {
          throw new Error(`RAPNA LEGACY repite identidades operativas entre a\xF1os: ${crossYearLegacy.slice(0, 20).join(", ")}`);
        }
        await lease.renew();
        const persisted = await store.persistSuccess("RAPNA", fetched.alerts, { ownerId: lease.ownerId, now: () => nowIso2(options) });
        const accounted = (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0) + (persisted.unchangedCount ?? 0) + (persisted.retentionRejectedCount ?? 0);
        const hasFullAccounting = persisted.unchangedCount !== void 0 || persisted.retentionRejectedCount !== void 0;
        if (hasFullAccounting && accounted !== fetched.alerts.length) {
          throw new Error(`Persistencia RAPNA LEGACY no contabilizada: ${accounted}/${fetched.alerts.length}`);
        }
        const renewed = await lease.renew();
        const nextCursor = running.cursor + 1;
        const at2 = nowIso2(options);
        const completed = nextCursor >= plan.length;
        running = {
          ...running,
          status: completed ? "completed" : "partial",
          cursor: nextCursor,
          cursorKey: legacyUnitKey(unit),
          pagesScanned: running.pagesScanned + fetched.pagesScanned,
          recordsObserved: running.recordsObserved + fetched.recordsObserved,
          recordsPersisted: running.recordsPersisted + (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
          newCount: running.newCount + (persisted.newCount ?? 0),
          updatedCount: running.updatedCount + (persisted.updatedCount ?? 0),
          oldestPublishedAt: minDate2(running.oldestPublishedAt, fetched.oldestPublishedAt),
          newestPublishedAt: maxDate2(running.newestPublishedAt, fetched.newestPublishedAt),
          coverage: completed ? "official-index-complete" : "partial",
          lastSuccessAt: at2,
          completedAt: completed ? at2 : null,
          leaseExpiresAt: renewed.expiresAt,
          updatedAt: at2
        };
        await syncState3.write(running);
      } catch (error) {
        const at2 = nowIso2(options);
        const failed = {
          ...running,
          status: "partial",
          pageErrors: running.pageErrors + 1,
          lastError: errorMessage2(error),
          leaseOwnerId: null,
          leaseMode: null,
          leaseExpiresAt: null,
          updatedAt: at2
        };
        if (!(error instanceof SyncLeaseLostError)) await syncState3.write(failed);
        return failed;
      }
    }
    const at = nowIso2(options);
    const finalState = { ...running, leaseOwnerId: null, leaseMode: null, leaseExpiresAt: null, updatedAt: at };
    await syncState3.write(finalState);
    return finalState;
  } finally {
    await lease.release();
  }
}
var emptyState2 = (mode, now = nowIso2()) => ({
  source: "RAPNA",
  mode,
  status: "idle",
  cursor: 0,
  totalUnits: 0,
  pagesScanned: 0,
  recordsObserved: 0,
  recordsPersisted: 0,
  newCount: 0,
  updatedCount: 0,
  detailFailures: 0,
  pageErrors: 0,
  oldestPublishedAt: null,
  newestPublishedAt: null,
  coverage: "unknown",
  startedAt: null,
  lastSuccessAt: null,
  completedAt: null,
  lastError: null,
  leaseOwnerId: null,
  leaseMode: null,
  leaseExpiresAt: null,
  lastSkippedAt: null,
  lastSkipReason: null,
  lastSkippedOwnerId: null,
  updatedAt: now
});
var requireSyncState = (store) => {
  if (!store.readSyncState || !store.writeSyncState) throw new Error("AlertStore no dispone de estado de sincronizaci\xF3n");
  return { read: store.readSyncState.bind(store), write: store.writeSyncState.bind(store) };
};
async function skippedState(store, mode, ownerId, active, options, reason = "already-running") {
  const at = nowIso2(options);
  const previous = await store.readSyncState?.("RAPNA", mode) ?? emptyState2(mode, at);
  await store.recordSyncSkip?.("RAPNA", mode, ownerId, at, reason);
  return {
    ...previous,
    status: "skipped",
    leaseOwnerId: active?.ownerId ?? null,
    leaseMode: active?.mode ?? null,
    leaseExpiresAt: active?.expiresAt ?? null,
    lastSkippedAt: at,
    lastSkipReason: reason,
    lastSkippedOwnerId: ownerId,
    updatedAt: at
  };
}
async function runRapnaRecentSync(store, client = {}, options = {}) {
  const sync = requireSyncState(store);
  const lease = await acquireSourceLease(store, "RAPNA", "recent", options);
  if (!lease.acquired) return skippedState(store, "recent", lease.ownerId, lease.lease, options);
  try {
    const [backfill, currentSnapshot] = await Promise.all([
      store.findRapnaSnapshot?.(["backfill-running"]),
      store.findRapnaCurrentSnapshotManifest?.(["building", "backfill-running", "restore-running"])
    ]);
    if (backfill || currentSnapshot) {
      return await skippedState(store, "recent", lease.ownerId, null, options, "backfill-active");
    }
    const startedAt = nowIso2(options);
    const previous = await sync.read("RAPNA", "recent") ?? emptyState2("recent", startedAt);
    const running = {
      ...previous,
      status: "running",
      cursor: 0,
      totalUnits: 0,
      pagesScanned: 0,
      recordsObserved: 0,
      recordsPersisted: 0,
      newCount: 0,
      updatedCount: 0,
      detailFailures: 0,
      pageErrors: 0,
      oldestPublishedAt: null,
      newestPublishedAt: null,
      coverage: "partial",
      startedAt,
      completedAt: null,
      lastError: null,
      leaseOwnerId: lease.ownerId,
      leaseMode: "recent",
      leaseExpiresAt: lease.lease.expiresAt,
      updatedAt: startedAt
    };
    await sync.write(running);
    try {
      const fetched = await fetchRapnaRecent(previous.lastSuccessAt, client, startedAt);
      if (!fetched.alerts.length && fetched.recordsObserved > 0) {
        throw new Error("RAPNA devolvi\xF3 registros recientes, pero ninguno era suficientemente completo para persistir");
      }
      const renewed = await lease.renew();
      running.leaseExpiresAt = renewed.expiresAt;
      running.updatedAt = renewed.heartbeatAt;
      await sync.write(running);
      const persisted = await store.persistSuccess("RAPNA", fetched.alerts, { ownerId: lease.ownerId, now: () => nowIso2(options) });
      await lease.renew();
      const completedAt = nowIso2(options);
      const state = {
        ...running,
        status: fetched.invalidRecords ? "partial" : "completed",
        cursor: fetched.pagesScanned,
        totalUnits: fetched.pagesScanned,
        pagesScanned: fetched.pagesScanned,
        recordsObserved: fetched.recordsObserved,
        recordsPersisted: (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
        newCount: persisted.newCount ?? 0,
        updatedCount: persisted.updatedCount ?? 0,
        detailFailures: fetched.invalidRecords,
        oldestPublishedAt: fetched.oldestPublishedAt,
        newestPublishedAt: fetched.newestPublishedAt,
        lastSuccessAt: completedAt,
        completedAt,
        lastError: fetched.invalidRecords ? `${fetched.invalidRecords} registros RAPNA incompletos no se persistieron` : null,
        leaseOwnerId: null,
        leaseMode: null,
        leaseExpiresAt: null,
        updatedAt: completedAt
      };
      await sync.write(state);
      return state;
    } catch (error) {
      const failedAt = nowIso2(options);
      const state = {
        ...running,
        status: "failed",
        pageErrors: 1,
        lastError: errorMessage2(error),
        leaseOwnerId: null,
        leaseMode: null,
        leaseExpiresAt: null,
        updatedAt: failedAt
      };
      if (!(error instanceof SyncLeaseLostError)) {
        try {
          await store.persistFailure("RAPNA", error, { ownerId: lease.ownerId, now: () => nowIso2(options) });
        } catch {
        }
        await sync.write(state);
      }
      return state;
    }
  } finally {
    await lease.release();
  }
}

// candidate-probe-v4-src/lib/rasff-published.ts
var record5 = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
var stableValue5 = (value) => {
  if (Array.isArray(value)) return value.map(stableValue5).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stableValue5(child)]));
  return value;
};
var TECHNICAL_DETAIL_FIELDS = /* @__PURE__ */ new Set(["lastUpdate"]);
var detail2 = (canonical) => record5(canonical.sourceRecord.detail);
var rasffOfficialSourceProjection = (canonical) => {
  if (canonical.identity.source !== "RASFF") return null;
  const raw = detail2(canonical);
  if (!raw) return null;
  return stableValue5(Object.fromEntries(Object.entries(raw).filter(([key]) => !TECHNICAL_DETAIL_FIELDS.has(key))));
};
var sha2565 = async (value) => {
  const digest2 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest2)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
async function rasffContentHash(canonical) {
  const official = rasffOfficialSourceProjection(canonical);
  if (official === null) throw new Error("RASFF canonical detail is required to compute the official content hash");
  return sha2565(JSON.stringify(official));
}

// candidate-probe-v4-src/lib/rasff.ts
var RASFF_PUBLIC_BASE = "https://webgate.ec.europa.eu/rasff-window";
var RASFF_SEARCH_ENDPOINT = `${RASFF_PUBLIC_BASE}/backend/public/notification/search/consolidated/en/`;
var RASFF_DETAIL_ENDPOINT = `${RASFF_PUBLIC_BASE}/backend/public/notification/view/id`;
var RASFF_OPEN_DATA_ENDPOINT = "https://api.datalake.sante.service.ec.europa.eu/rasff/irasff-general-info-view";
var RASFF_OPEN_DATA_API_VERSION = "v1.1";
var RASFF_PAGE_SIZE = 100;
var RASFF_HOT_MAX_DETAILS = 40;
var RASFF_HOT_OVERLAP_DETAILS = 20;
var RASFF_HOT_INDEX_PAGE_LIMIT = 20;
var RasffRequestError = class extends Error {
  constructor(message, kind = "invalid-response", statusCode, attempts = 1) {
    super(message);
    this.kind = kind;
    this.statusCode = statusCode;
    this.attempts = attempts;
  }
};
var RASFF_REQUEST_TIMEOUT_MS = 6e4;
var RASFF_DETAIL_MAX_ATTEMPTS = 3;
var record6 = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
var array2 = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
var string2 = (value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim() : "";
var number = (value) => Number.isInteger(Number(value)) ? Number(value) : NaN;
var description = (value) => string2(record6(value).description);
var uniqueStrings2 = (values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
var brusselsParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});
function parseRasffOfficialDate(value) {
  const raw = string2(value);
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/u);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = match;
  const targetWall = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
  const probe = new Date(targetWall);
  if (probe.getUTCFullYear() !== Number(yyyy) || probe.getUTCMonth() !== Number(mm) - 1 || probe.getUTCDate() !== Number(dd) || probe.getUTCHours() !== Number(hh) || probe.getUTCMinutes() !== Number(mi) || probe.getUTCSeconds() !== Number(ss)) return null;
  let candidate = targetWall;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = Object.fromEntries(brusselsParts.formatToParts(new Date(candidate)).filter(({ type }) => type !== "literal").map(({ type, value: value2 }) => [type, Number(value2)]));
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    candidate += targetWall - observed;
  }
  return new Date(candidate).toISOString();
}
var country = (value) => {
  const row = record6(value);
  const organizationName = string2(row.organizationName) || string2(row.description);
  const isoCode = string2(row.isoCode).toUpperCase() || string2(row.code).toUpperCase();
  return organizationName || isoCode ? { organizationName, isoCode } : null;
};
var countries = (value) => array2(value).map(country).filter((entry) => Boolean(entry)).filter((entry, index2, all) => all.findIndex((candidate) => candidate.isoCode === entry.isoCode && candidate.organizationName === entry.organizationName) === index2);
async function requestJson2(url, init, client = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), client.timeoutMs ?? RASFF_REQUEST_TIMEOUT_MS);
  try {
    const response = await (client.fetch ?? fetch)(url, {
      ...init,
      signal: controller.signal,
      headers: { "user-agent": "NagameAlert-RASFF/1.0", accept: "application/json", ...init.headers ?? {} }
    });
    const text4 = await response.text();
    if (!response.ok) throw new RasffRequestError(`RASFF devolvi\xF3 HTTP ${response.status} para ${url}`, "http", response.status);
    try {
      return JSON.parse(text4);
    } catch {
      throw new RasffRequestError("RASFF devolvi\xF3 JSON inv\xE1lido", "invalid-response");
    }
  } catch (error) {
    if (error instanceof RasffRequestError) throw error;
    if (controller.signal.aborted) throw new RasffRequestError(`RASFF agot\xF3 el timeout para ${url}`, "timeout");
    if (error instanceof Error && error.name === "AbortError") {
      throw new RasffRequestError(`RASFF abort\xF3 la petici\xF3n para ${url}`, "transport");
    }
    throw new RasffRequestError(`RASFF sufri\xF3 un fallo de red para ${url}`, "transport");
  } finally {
    clearTimeout(timeout);
  }
}
function parseRasffIndexRow(value) {
  const raw = record6(value);
  const notifId = number(raw.notifId);
  const reference = string2(raw.reference);
  const ecValidationDate = string2(raw.ecValidationDate);
  const parsedValidationDate = parseRasffOfficialDate(ecValidationDate);
  const subject = string2(raw.subject) || null;
  if (!Number.isInteger(notifId) || notifId <= 0 || !/^\d{4}\.\d+$/u.test(reference) || !parsedValidationDate) {
    throw new RasffRequestError("RASFF devolvi\xF3 una fila de \xEDndice sin identidad o fecha v\xE1lidas", "data-missing");
  }
  return {
    notifId,
    reference,
    ecValidationDate,
    notifyingCountry: country(raw.notifyingCountry),
    subject,
    productCategory: Object.keys(record6(raw.productCategory)).length ? record6(raw.productCategory) : null,
    productType: Object.keys(record6(raw.productType)).length ? record6(raw.productType) : null,
    notificationClassification: Object.keys(record6(raw.notificationClassification)).length ? record6(raw.notificationClassification) : null,
    riskDecision: Object.keys(record6(raw.riskDecision)).length ? record6(raw.riskDecision) : null,
    published: typeof raw.published === "boolean" ? raw.published : null,
    originCountries: countries(raw.originCountries),
    raw
  };
}
function parseRasffSearchPage(payload, pageNumber, pageSize) {
  const root = record6(payload);
  const totalPages = number(root.totalPages);
  const totalElements = number(root.totalElements);
  const notifications = array2(root.notifications).map(parseRasffIndexRow);
  if (!Number.isInteger(totalPages) || totalPages < 0 || !Number.isInteger(totalElements) || totalElements < 0 || notifications.length > pageSize || totalElements > 0 && totalPages < 1) {
    throw new RasffRequestError("RASFF devolvi\xF3 metadatos de paginaci\xF3n incoherentes", "pagination");
  }
  return { notifications, totalPages, totalElements, pageNumber, pageSize };
}
async function fetchRasffIndexPage(pageNumber = 1, pageSize = RASFF_PAGE_SIZE, client = {}, ordering = "notificationECValidationDate", sorting = "desc") {
  const page = Math.max(1, Math.trunc(pageNumber));
  const size = Math.max(1, Math.min(RASFF_PAGE_SIZE, Math.trunc(pageSize)));
  const body = { parameters: { pageNumber: page, itemsPerPage: size, ordering, sorting } };
  return parseRasffSearchPage(await requestJson2(RASFF_SEARCH_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }, client), page, size);
}
async function fetchRasffIndexByReference(reference, client = {}) {
  const normalized = reference.trim();
  if (!/^\d{4}\.\d+$/u.test(normalized)) throw new RasffRequestError("Referencia RASFF no v\xE1lida", "identity");
  const body = { parameters: { pageNumber: 1, itemsPerPage: 25 }, notificationReference: normalized };
  const page = parseRasffSearchPage(await requestJson2(RASFF_SEARCH_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }, client), 1, 25);
  if (page.notifications.length > 1 || page.notifications[0] && page.notifications[0].reference !== normalized) {
    throw new RasffRequestError(`RASFF devolvi\xF3 una b\xFAsqueda ambigua para ${normalized}`, "identity");
  }
  return page.notifications[0] ?? null;
}
var isRetryableRasffDetailError = (error) => error instanceof RasffRequestError && (error.kind === "transport" || error.kind === "timeout" || error.kind === "http" && (error.statusCode === 429 || (error.statusCode ?? 0) >= 500));
function classifyRasffDeferredDetail(error, row) {
  if (!(error instanceof RasffRequestError) || !isRetryableRasffDetailError(error)) return null;
  const reason = error.kind === "timeout" ? "timeout" : error.kind === "transport" ? /abort/iu.test(error.message) ? "aborted" : "network" : error.statusCode === 429 ? "http-429" : "http-5xx";
  return {
    reference: row.reference,
    notifId: row.notifId,
    deferred: true,
    classification: error.kind === "http" ? "upstream" : "transport",
    reason,
    ...error.statusCode ? { statusCode: error.statusCode } : {},
    attempts: error.attempts
  };
}
async function fetchRasffDetail(notifId, client = {}) {
  if (!Number.isInteger(notifId) || notifId <= 0) throw new RasffRequestError("notifId RASFF no v\xE1lido", "identity");
  const maxAttempts = Math.max(1, Math.min(5, Math.trunc(client.detailMaxAttempts ?? RASFF_DETAIL_MAX_ATTEMPTS)));
  const retryDelayMs = Math.max(0, Math.min(5e3, Math.trunc(client.detailRetryDelayMs ?? 500)));
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const raw = record6(await requestJson2(`${RASFF_DETAIL_ENDPOINT}/${notifId}/`, { method: "GET" }, client));
      const id = number(raw.id);
      const reference = string2(raw.reference);
      if (id !== notifId || !/^\d{4}\.\d+$/u.test(reference) || !parseRasffOfficialDate(raw.ecValidationDate)) {
        throw new RasffRequestError(`RASFF devolvi\xF3 un detalle inv\xE1lido para ${notifId}`, "data-missing");
      }
      return { notifId: id, reference, raw, detailSource: "rasff-window" };
    } catch (error) {
      if (!isRetryableRasffDetailError(error) || attempt >= maxAttempts) {
        if (error instanceof RasffRequestError && isRetryableRasffDetailError(error)) {
          throw new RasffRequestError(error.message, error.kind, error.statusCode, attempt);
        }
        throw error;
      }
      if (retryDelayMs) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
  throw new RasffRequestError(`RASFF agot\xF3 los intentos de detail para ${notifId}`, "transport", void 0, maxAttempts);
}
var openDataText = (raw, key) => string2(raw[key]);
var openDataCountries = (value) => string2(value).split("***").map((entry) => entry.trim()).filter(Boolean);
var openDataHazards = (value) => openDataCountries(value).map((published) => {
  const match = published.match(/^(.*?)\s*-\s*\{(.*)\}\s*$/u);
  return match ? { name: match[1].trim(), hazardCategory: { description: match[2].trim() }, published } : { name: published, published };
});
var openDataFlags = (raw) => [
  ...openDataCountries(raw.NOTIFYNG_COUNTRY_DESC).map((description2) => ({ description: description2, flagType: "NOTIFYING" })),
  ...openDataCountries(raw.ORIGIN_COUNTRY_DESC).map((description2) => ({ description: description2, flagType: "ORIGIN" })),
  ...openDataCountries(raw.DISTRIBUTION_COUNTRY_DESC).map((description2) => ({ description: description2, flagType: "DISTRIBUTION" }))
].map(({ description: organization, flagType }) => ({
  organization: { description: organization },
  notificationFlags: [{ flagType }]
}));
function parseRasffOpenDataDetail(payload, index2) {
  const root = record6(payload);
  if (!Array.isArray(root.value)) {
    throw new RasffRequestError("RASFF Data Lake devolvi\xF3 un payload estructuralmente inv\xE1lido", "invalid-response");
  }
  const rows = root.value.map(record6);
  if (!rows.length) return null;
  if (rows.length !== 1) {
    throw new RasffRequestError(`RASFF Data Lake devolvi\xF3 una b\xFAsqueda ambigua para ${index2.reference}`, "identity");
  }
  const sourceRaw = rows[0];
  const notifId = number(sourceRaw.NOTIF_ID);
  const reference = openDataText(sourceRaw, "NOTIFICATION_REFERENCE");
  const network = openDataText(sourceRaw, "NETWORK_DESC");
  const openDate = openDataText(sourceRaw, "NOTIF_DATE").match(/^(\d{4})-(\d{2})-(\d{2})T/u);
  const indexDate = index2.ecValidationDate.match(/^(\d{2})-(\d{2})-(\d{4})/u);
  if (notifId !== index2.notifId || reference !== index2.reference || network !== "RASFF" || !openDate || !indexDate || `${openDate[1]}-${openDate[2]}-${openDate[3]}` !== `${indexDate[3]}-${indexDate[2]}-${indexDate[1]}`) {
    throw new RasffRequestError(`Identidad RASFF incoherente en Data Lake para ${index2.reference}`, "identity");
  }
  const productName = openDataText(sourceRaw, "PRODUCT_NAME");
  const productCategory = openDataText(sourceRaw, "PRODUCT_CATEGORY_DESC");
  const productType = openDataText(sourceRaw, "NOTIFICATION_TYPE_DESC");
  const classification = openDataText(sourceRaw, "NOTIFICATION_CLASSIFICAT_DESC");
  const basis = openDataText(sourceRaw, "NOTIFICATION_BASIS_DESC");
  const distributionStatus = openDataText(sourceRaw, "DISTRIBUTION_STATUS_DESC");
  const riskDecision = openDataText(sourceRaw, "RISK_DECISION_DESC");
  const raw = {
    id: notifId,
    reference,
    subject: openDataText(sourceRaw, "NOTIF_SUBJECT") || null,
    ecValidationDate: index2.ecValidationDate,
    notificationStatus: openDataText(sourceRaw, "NOTIFICATION_STATUS_DESC") || null,
    notificationClassification: classification ? { description: classification } : null,
    notificationBasis: basis ? { description: basis } : null,
    productType: productType ? { description: productType } : null,
    product: {
      description: productName || null,
      productCategory: productCategory ? { description: productCategory } : null,
      distributionStatus: distributionStatus ? { description: distributionStatus } : null,
      hazards: openDataHazards(sourceRaw.HAZARD_CATEGORY_NAME),
      measures: []
    },
    risk: { riskDecision: riskDecision || null },
    organizationFlags: openDataFlags(sourceRaw),
    followups: []
  };
  return { notifId, reference, raw, detailSource: "sante-datalake-v1.1", sourceRaw };
}
async function fetchRasffOpenDataDetail(index2, client = {}) {
  const url = new URL(RASFF_OPEN_DATA_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("api-version", RASFF_OPEN_DATA_API_VERSION);
  url.searchParams.set("NETWORK_DESC", "RASFF");
  url.searchParams.set("NOTIFICATION_REFERENCE", index2.reference);
  const maxAttempts = Math.max(1, Math.min(5, Math.trunc(client.detailMaxAttempts ?? RASFF_DETAIL_MAX_ATTEMPTS)));
  const retryDelayMs = Math.max(0, Math.min(5e3, Math.trunc(client.detailRetryDelayMs ?? 500)));
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return parseRasffOpenDataDetail(await requestJson2(url.toString(), { method: "GET" }, client), index2);
    } catch (error) {
      if (error instanceof RasffRequestError && error.kind === "http" && error.statusCode === 404) return null;
      if (!isRetryableRasffDetailError(error) || attempt >= maxAttempts) {
        if (error instanceof RasffRequestError && isRetryableRasffDetailError(error)) {
          throw new RasffRequestError(error.message, error.kind, error.statusCode, attempt);
        }
        throw error;
      }
      if (retryDelayMs) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
  return null;
}
async function fetchRasffDetailWithFallback(index2, client = {}) {
  try {
    return await fetchRasffDetail(index2.notifId, client);
  } catch (error) {
    if (!classifyRasffDeferredDetail(error, index2)) throw error;
    const fallback = await fetchRasffOpenDataDetail(index2, client);
    if (fallback) return fallback;
    throw error;
  }
}
var rasffOfficialUrl = (notifId) => `${RASFF_PUBLIC_BASE}/screen/notification/${notifId}`;
function classifyRasffDomain(productType) {
  const value = (typeof productType === "string" ? productType : description(productType)).trim().toLowerCase();
  if (value === "food") return { normalized: "Alimentaria", rule: "rasff-product-type-food" };
  if (value === "feed") return { normalized: "Alimentaci\xF3n animal", rule: "rasff-product-type-feed" };
  if (value === "food contact material" || value === "food contact materials") return { normalized: "No alimentaria", rule: "rasff-product-type-food-contact-material" };
  return { normalized: "Sin clasificar", rule: `rasff-product-type-${value || "missing"}` };
}
var priorityFromRisk = (value) => /^serious$/iu.test(value.trim()) ? "Alta" : "Media";
var valueOrMissing = (published, normalized, seed, sourceField) => published && normalized ? knownValue(published, normalized, seed, sourceField) : missingValue();
var rawProduct = (detail3) => record6(detail3.product);
var rawRisk = (detail3) => record6(detail3.risk);
var hazardRows = (detail3) => array2(rawProduct(detail3).hazards).map(record6);
var measureRows = (detail3) => array2(rawProduct(detail3).measures).map(record6);
var hazardNames = (detail3) => uniqueStrings2(hazardRows(detail3).map((row) => string2(row.name)));
var hazardCategories = (detail3) => uniqueStrings2(hazardRows(detail3).map((row) => description(row.hazardCategory)));
var measures = (detail3) => uniqueStrings2(measureRows(detail3).map((row) => description(row.actionTaken)));
var followups = (detail3) => array2(detail3.followups).map(record6);
function rasffCountryRoles(detail3, index2) {
  const origins = [...index2?.originCountries ?? []];
  const notifying = index2?.notifyingCountry ? [index2.notifyingCountry] : [];
  const distribution = [];
  for (const row of array2(detail3.organizationFlags).map(record6)) {
    const organization = record6(row.organization);
    const entry = country({ organizationName: organization.description, isoCode: organization.code });
    if (!entry) continue;
    const flagTypes = new Set(array2(row.notificationFlags).map(record6).map((flag) => string2(flag.flagType).toUpperCase()).filter(Boolean));
    if (flagTypes.has("ORIGIN")) origins.push(entry);
    if (flagTypes.has("NOTIFYING")) notifying.push(entry);
    if (flagTypes.has("DISTRIBUTION")) distribution.push(entry);
  }
  const dedupe2 = (rows) => rows.filter((entry, index3, all) => all.findIndex((candidate) => entry.isoCode && candidate.isoCode === entry.isoCode || !entry.isoCode && candidate.organizationName === entry.organizationName) === index3);
  return { origins: dedupe2(origins), notifying: dedupe2(notifying), distribution: dedupe2(distribution) };
}
async function normalizeRasffDetail(detail3, index2 = null, detectedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const raw = detail3.raw;
  const reference = detail3.reference;
  if (index2 && (index2.reference !== reference || index2.notifId !== detail3.notifId)) {
    throw new RasffRequestError(`Identidad RASFF incoherente entre \xEDndice y detalle para ${reference}`, "identity");
  }
  const officialUrl2 = rasffOfficialUrl(detail3.notifId);
  const seed = { source: "RASFF", sourceRecordId: reference, officialUrl: officialUrl2 };
  const id = sourceScopedId("RASFF", reference);
  const subject = string2(raw.subject) || null;
  const product = rawProduct(raw);
  const productName = string2(product.description);
  const productId = number(product.id);
  const category = description(product.productCategory) || description(index2?.productCategory);
  const productType = description(raw.productType) || description(index2?.productType);
  const domain = classifyRasffDomain(productType);
  const risk = rawRisk(raw);
  const riskDecision = string2(risk.riskDecision) || description(index2?.riskDecision);
  const hazardObserved = string2(risk.hazardObserved);
  const hazards = hazardNames(raw);
  const categories = hazardCategories(raw);
  const actionRows = measures(raw);
  const publishedAt = parseRasffOfficialDate(raw.ecValidationDate);
  const officialUpdatedAt = parseRasffOfficialDate(raw.lastUpdate);
  const hasOfficialProduct = Boolean(productName) || Number.isInteger(productId) && productId > 0;
  if (!hasOfficialProduct || !publishedAt) throw new RasffRequestError(`Detalle RASFF ${reference} incompleto`, "data-missing");
  const roles = rasffCountryRoles(raw, index2);
  const firstOrigin = roles.origins[0];
  const firstNotifying = roles.notifying[0];
  const distributionNames = roles.distribution.map((entry) => entry.organizationName || entry.isoCode);
  const officialUpdate = Boolean(officialUpdatedAt && officialUpdatedAt !== publishedAt) || followups(raw).length > 0;
  const resources = [{ kind: "official_page", url: officialUrl2, label: "Ficha oficial RASFF" }];
  const canonical = {
    identity: { internalId: id, source: "RASFF", sourceRecordId: reference, officialReference: reference, officialUrl: officialUrl2 },
    headline: subject ? knownValue(subject, subject, seed, "subject") : missingValue(),
    dates: {
      publishedAt: knownValue(string2(raw.ecValidationDate), publishedAt, seed, "ecValidationDate"),
      detectedAt,
      officialUpdatedAt: officialUpdatedAt ? knownValue(string2(raw.lastUpdate), officialUpdatedAt, seed, "lastUpdate") : missingValue("unknown")
    },
    lifecycle: { officialUpdate: knownValue(officialUpdate, officialUpdate, seed, "lastUpdate/followups") },
    product: {
      name: productName ? knownValue(productName, productName, seed, "product.description") : missingValue(),
      category: valueOrMissing(category, category, seed, "product.productCategory.description"),
      domain: domain.normalized,
      model: missingValue(),
      commercialReference: missingValue(),
      lots: missingValue(),
      identifiers: []
    },
    operators: [],
    geography: {
      originCountry: firstOrigin ? knownValue(
        firstOrigin.organizationName || firstOrigin.isoCode,
        firstOrigin.organizationName || firstOrigin.isoCode,
        seed,
        "originCountries/organizationFlags"
      ) : missingValue(),
      notifyingCountry: firstNotifying ? knownValue(
        firstNotifying.organizationName || firstNotifying.isoCode,
        firstNotifying.organizationName || firstNotifying.isoCode,
        seed,
        "notifyingCountry/organizationFlags"
      ) : missingValue(),
      affectedTerritories: distributionNames.length ? knownValue(distributionNames, distributionNames, seed, "organizationFlags:distribution") : missingValue(),
      distribution: distributionNames.length ? knownValue(distributionNames.join(", "), distributionNames.join(", "), seed, "organizationFlags:distribution") : valueOrMissing(description(product.distributionStatus), description(product.distributionStatus), seed, "product.distributionStatus.description")
    },
    risk: {
      type: categories.length ? knownValue(categories, categories, seed, "product.hazards[].hazardCategory.description") : missingValue(),
      hazard: hazards.length ? knownValue(hazards.join("; "), hazards.join("; "), seed, "product.hazards[].name") : missingValue(),
      description: valueOrMissing(hazardObserved, hazardObserved, seed, "risk.hazardObserved"),
      reason: valueOrMissing(riskDecision, riskDecision, seed, "risk.riskDecision"),
      measures: actionRows.length ? knownValue(actionRows, actionRows, seed, "product.measures[].actionTaken.description") : missingValue(),
      recommendations: missingValue(),
      priority: riskDecision ? knownValue(riskDecision, riskDecision, seed, "risk.riskDecision") : missingValue()
    },
    resources,
    sourceRecord: {
      schemaVersion: 1,
      detailLevel: "official-detail",
      detailSource: detail3.detailSource ?? "rasff-window",
      notifId: detail3.notifId,
      productDomainRule: domain.rule,
      index: index2?.raw ?? null,
      detail: raw,
      ...detail3.sourceRaw ? { openData: detail3.sourceRaw } : {}
    }
  };
  const contentHash = await rasffContentHash(canonical);
  const priority = priorityFromRisk(riskDecision);
  return {
    id,
    reference,
    source: "RASFF",
    type: domain.normalized,
    priority,
    title: subject ?? "",
    product: productName,
    brand: "",
    productClass: category || "Sin clasificar",
    productKey: productName.toLocaleLowerCase("en"),
    brandKey: "",
    provider: "",
    providerKey: "",
    providerRole: "",
    providerEvidence: "",
    hazard: hazards.join("; ") || hazardObserved || "Consultar publicaci\xF3n oficial",
    origin: firstOrigin?.organizationName || firstOrigin?.isoCode || "No indicado",
    scope: distributionNames.length ? distributionNames.join(", ") : description(product.distributionStatus) || "No indicado",
    action: actionRows.join("; ") || "Consultar publicaci\xF3n oficial",
    lots: [],
    imageUrl: null,
    url: officialUrl2,
    publishedAt,
    detectedAt,
    updatedAt: officialUpdatedAt ?? publishedAt,
    contentHash,
    versionCount: 1,
    isUpdate: officialUpdate,
    canonical
  };
}
async function hydrateRasffRows(rows, client, detectedAt) {
  const results = new Array(rows.length);
  let cursor = 0, processed = 0;
  const concurrency = Math.max(1, Math.min(10, Math.trunc(client.detailConcurrency ?? 6)));
  const workers = Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (true) {
      const current = cursor++;
      if (current >= rows.length) return;
      const index2 = rows[current];
      try {
        let detail3;
        try {
          detail3 = await fetchRasffDetailWithFallback(index2, client);
        } catch (error) {
          const deferred = classifyRasffDeferredDetail(error, index2);
          if (deferred) {
            results[current] = deferred;
            continue;
          }
          throw error;
        }
        results[current] = await normalizeRasffDetail(detail3, index2, detectedAt);
      } catch (error) {
        results[current] = error instanceof Error ? error : new Error("Error sem\xE1ntico RASFF no identificado");
      } finally {
        processed += 1;
        if (processed % 25 === 0 || processed === rows.length) await client.onDetailBatch?.(processed);
      }
    }
  });
  await Promise.all(workers);
  const semanticFailure = results.find((result) => result instanceof Error);
  if (semanticFailure instanceof Error) throw semanticFailure;
  const deferredDetails = results.filter((result) => Boolean(result && !(result instanceof Error) && "deferred" in result));
  const alerts2 = results.filter((result) => Boolean(result && !(result instanceof Error) && !("deferred" in result)));
  return { alerts: alerts2, deferredDetails };
}
var resultDates = (alerts2) => {
  const dates = alerts2.flatMap((alert) => alert.publishedAt ? [alert.publishedAt] : []).sort();
  return { oldest: dates[0] ?? null, newest: dates.at(-1) ?? null };
};
async function fetchRasffRecent(anchorReference = null, client = {}, detectedAt = (/* @__PURE__ */ new Date()).toISOString(), requestedMaxDetails = RASFF_HOT_MAX_DETAILS) {
  const maxDetails = Math.max(1, Math.min(RASFF_HOT_MAX_DETAILS, Math.trunc(requestedMaxDetails)));
  const first = await fetchRasffIndexPage(1, RASFF_PAGE_SIZE, client);
  if (!first.notifications.length) return {
    alerts: [],
    pagesScanned: 1,
    recordsObserved: 0,
    detailFailures: 0,
    deferredDetails: [],
    oldestPublishedAt: null,
    newestPublishedAt: null,
    totalElements: first.totalElements,
    totalPages: first.totalPages,
    nextPage: 1,
    hasMore: false,
    nextCursorKey: null,
    newRecordCount: 0,
    overlapCount: 0
  };
  const rows = [];
  const identities = /* @__PURE__ */ new Set();
  const appendPage = (page) => {
    if (page.totalElements !== first.totalElements || page.totalPages !== first.totalPages) {
      throw new RasffRequestError("RASFF cambi\xF3 el \xEDndice durante la lectura incremental reciente", "pagination");
    }
    for (const row of page.notifications) {
      if (identities.has(row.reference)) throw new RasffRequestError("RASFF repiti\xF3 una referencia entre p\xE1ginas recientes", "pagination");
      identities.add(row.reference);
      rows.push(row);
    }
  };
  appendPage(first);
  let pagesScanned = 1;
  let anchorIndex = anchorReference ? rows.findIndex((row) => row.reference === anchorReference) : -1;
  while (anchorReference && anchorIndex < 0 && pagesScanned < Math.min(first.totalPages, RASFF_HOT_INDEX_PAGE_LIMIT)) {
    const pageNumber = pagesScanned + 1;
    const page = await fetchRasffIndexPage(pageNumber, RASFF_PAGE_SIZE, client);
    appendPage(page);
    pagesScanned += 1;
    anchorIndex = rows.findIndex((row) => row.reference === anchorReference);
  }
  if (anchorReference && anchorIndex < 0) {
    throw new RasffRequestError(`RASFF no pudo recuperar el ancla reciente ${anchorReference} dentro del l\xEDmite seguro`, "pagination");
  }
  let selected = [];
  let newRecordCount = 0;
  let overlapCount = 0;
  let nextCursorKey = first.notifications[0]?.reference ?? anchorReference;
  let hasMore = false;
  if (!anchorReference) {
    selected = rows.slice(0, maxDetails);
    newRecordCount = selected.length;
  } else {
    const newRows = rows.slice(0, anchorIndex);
    if (newRows.length > maxDetails) {
      selected = newRows.slice(-maxDetails);
      newRecordCount = selected.length;
      nextCursorKey = selected[0]?.reference ?? anchorReference;
      hasMore = true;
    } else {
      selected = [...newRows];
      newRecordCount = newRows.length;
      const selectedRefs = new Set(selected.map((row) => row.reference));
      const overlapBudget = Math.min(RASFF_HOT_OVERLAP_DETAILS, maxDetails - selected.length);
      for (const row of rows) {
        if (overlapCount >= overlapBudget) break;
        if (selectedRefs.has(row.reference)) continue;
        selected.push(row);
        selectedRefs.add(row.reference);
        overlapCount += 1;
      }
    }
  }
  const { alerts: alerts2, deferredDetails } = await hydrateRasffRows(selected, client, detectedAt);
  const dates = resultDates(alerts2);
  return {
    alerts: alerts2,
    pagesScanned,
    recordsObserved: rows.length,
    detailFailures: deferredDetails.length,
    deferredDetails,
    oldestPublishedAt: dates.oldest,
    newestPublishedAt: dates.newest,
    totalElements: first.totalElements,
    totalPages: first.totalPages,
    nextPage: 1,
    hasMore,
    nextCursorKey,
    newRecordCount,
    overlapCount
  };
}

// candidate-probe-v4-src/lib/rasff-reconcile.ts
var RASFF_RECONCILE_PLAN_VERSION = "rasff-reconcile-v1";
var RASFF_RECONCILE_PAGE_SIZE = 100;
var RASFF_RECONCILE_DEFAULT_BATCH_SIZE = 40;
var RASFF_RECONCILE_MAX_BATCH_SIZE = 40;
var indexCalendarDate = (value) => {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})\s/u);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};
var isOperationalIndexRecord = (record7) => {
  const date = indexCalendarDate(record7.ecValidationDate);
  if (!date) throw new Error(`RASFF ${record7.reference} has an unreadable validation date`);
  return date >= VIGIA_OPERATIONAL_HISTORY_FROM;
};
var resultRange = (alerts2) => {
  const dates = alerts2.flatMap((alert) => alert.publishedAt ? [alert.publishedAt] : []).sort();
  return { oldest: dates[0] ?? null, newest: dates.at(-1) ?? null };
};
var growingTotal = (expected, observed, phase) => {
  if (observed < expected) {
    throw new Error(`RASFF reconciliation index shrank during ${phase}`);
  }
  return Math.max(expected, observed);
};
var fetchAscendingPage = (pageNumber, client) => fetchRasffIndexPage(pageNumber, RASFF_RECONCILE_PAGE_SIZE, client, "notificationECValidationDate", "asc");
async function locateCursor(cursor, cursorKey, client) {
  if (cursor === 0) {
    const first = await fetchAscendingPage(1, client);
    return { absoluteNext: 0, expectedTotal: first.totalElements, pagesScanned: 1, pageNumber: 1, page: first };
  }
  if (!cursorKey) throw new Error("RASFF reconciliation cursor is missing its stable reference anchor");
  const expectedPage = Math.floor((cursor - 1) / RASFF_RECONCILE_PAGE_SIZE) + 1;
  const candidates = [...new Set([expectedPage, expectedPage - 1, expectedPage + 1].filter((page) => page >= 1))];
  let expectedTotal = null;
  let pagesScanned = 0;
  for (const pageNumber of candidates) {
    const page = await fetchAscendingPage(pageNumber, client);
    pagesScanned += 1;
    expectedTotal = expectedTotal === null ? page.totalElements : growingTotal(expectedTotal, page.totalElements, "cursor recovery");
    const index2 = page.notifications.findIndex((record7) => record7.reference === cursorKey);
    if (index2 >= 0) {
      return {
        absoluteNext: (pageNumber - 1) * RASFF_RECONCILE_PAGE_SIZE + index2 + 1,
        expectedTotal,
        pagesScanned,
        pageNumber,
        page
      };
    }
  }
  throw new Error(`RASFF reconciliation anchor ${cursorKey} could not be recovered near cursor ${cursor}`);
}
async function fetchRasffReconcileBatch(cursor = 0, cursorKey = null, client = {}, detectedAt = (/* @__PURE__ */ new Date()).toISOString(), requestedBatchSize = RASFF_RECONCILE_DEFAULT_BATCH_SIZE) {
  const batchSize = Math.max(1, Math.min(RASFF_RECONCILE_MAX_BATCH_SIZE, Math.trunc(requestedBatchSize)));
  const located = await locateCursor(cursor, cursorKey, client);
  let absolute = located.absoluteNext;
  let expectedTotal = located.expectedTotal;
  let pagesScanned = located.pagesScanned;
  const selected = [];
  let processedCount = 0;
  let archiveSkippedCount = 0;
  let lastRecord = null;
  const pageCache = /* @__PURE__ */ new Map([
    [located.pageNumber, located.page]
  ]);
  const pageFor = async (pageNumber) => {
    const cached = pageCache.get(pageNumber);
    if (cached) return cached;
    const page = await fetchAscendingPage(pageNumber, client);
    pagesScanned += 1;
    expectedTotal = growingTotal(expectedTotal, page.totalElements, "batch discovery");
    pageCache.set(pageNumber, page);
    return page;
  };
  while (absolute < expectedTotal && selected.length < batchSize) {
    const pageNumber = Math.floor(absolute / RASFF_RECONCILE_PAGE_SIZE) + 1;
    const page = await pageFor(pageNumber);
    const index2 = absolute % RASFF_RECONCILE_PAGE_SIZE;
    const sourceRow = page.notifications[index2];
    if (!sourceRow) throw new Error(`RASFF reconciliation page ${pageNumber} truncated before absolute index ${absolute}`);
    lastRecord = sourceRow;
    processedCount += 1;
    absolute += 1;
    if (!isOperationalIndexRecord(sourceRow)) {
      archiveSkippedCount += 1;
      continue;
    }
    selected.push(sourceRow);
  }
  const { alerts: alerts2, deferredDetails } = await hydrateRasffRows(selected, {
    ...client,
    detailConcurrency: Math.max(1, Math.min(8, Math.trunc(client.detailConcurrency ?? 6)))
  }, detectedAt);
  const range = resultRange(alerts2);
  const completedSweep = absolute >= expectedTotal;
  return {
    alerts: alerts2,
    processedCount,
    retainedCount: selected.length,
    archiveSkippedCount,
    detailFailures: deferredDetails.length,
    deferredDetails,
    pagesScanned,
    totalElements: expectedTotal,
    nextCursor: completedSweep ? 0 : absolute,
    nextCursorKey: completedSweep ? null : lastRecord?.reference ?? cursorKey,
    completedSweep,
    oldestPublishedAt: range.oldest,
    newestPublishedAt: range.newest
  };
}

// candidate-probe-v4-src/lib/rasff-sync.ts
var nowIso3 = (options = {}) => (options.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
var errorMessage3 = (error) => error instanceof Error ? error.message : "Error RASFF no identificado";
var minDate3 = (a, b) => !b ? a : !a || b < a ? b : a;
var maxDate3 = (a, b) => !b ? a : !a || b > a ? b : a;
var deferredSummary = (count) => count > 0 ? `${count} detalles RASFF diferidos por transporte/upstream durante este sweep` : null;
async function repairRasffDetails(store, requests, client = {}, detectedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  if (!requests.length || requests.length > 40) throw new Error("repair-detail requiere entre 1 y 40 identidades RASFF");
  const seenReferences = /* @__PURE__ */ new Set();
  const seenNotifIds = /* @__PURE__ */ new Set();
  for (const item of requests) {
    if (!/^\d{4}\.\d+$/u.test(item.reference) || !Number.isSafeInteger(item.notifId) || item.notifId <= 0 || seenReferences.has(item.reference) || seenNotifIds.has(item.notifId)) {
      throw new Error("repair-detail recibi\xF3 identidades RASFF inv\xE1lidas o duplicadas");
    }
    seenReferences.add(item.reference);
    seenNotifIds.add(item.notifId);
  }
  const indexRows = [];
  for (const item of requests) {
    const index2 = await fetchRasffIndexByReference(item.reference, client);
    if (!index2 || index2.reference !== item.reference || index2.notifId !== item.notifId) {
      throw new Error(`repair-detail no pudo validar la identidad RASFF ${item.reference}/${item.notifId}`);
    }
    indexRows.push(index2);
  }
  const hydrated = await hydrateRasffRows(indexRows, client, detectedAt);
  const repaired = [];
  const unchanged = [];
  for (const alert of hydrated.alerts) {
    const persisted = await store.persistSuccess("RASFF", [alert]);
    const identity2 = { reference: alert.reference, notifId: Number(alert.canonical.sourceRecord.notifId) };
    if ((persisted.newCount ?? 0) + (persisted.updatedCount ?? 0) > 0) repaired.push(identity2);
    else unchanged.push(identity2);
  }
  return { repaired, unchanged, failed: hydrated.deferredDetails };
}
var emptyState3 = (mode, now = (/* @__PURE__ */ new Date()).toISOString()) => ({
  source: "RASFF",
  mode,
  status: "idle",
  cursor: 0,
  planVersion: null,
  cursorKey: null,
  totalUnits: 0,
  pagesScanned: 0,
  recordsObserved: 0,
  recordsPersisted: 0,
  newCount: 0,
  updatedCount: 0,
  detailFailures: 0,
  pageErrors: 0,
  oldestPublishedAt: null,
  newestPublishedAt: null,
  coverage: "unknown",
  startedAt: null,
  lastSuccessAt: null,
  completedAt: null,
  lastError: null,
  leaseOwnerId: null,
  leaseMode: null,
  leaseExpiresAt: null,
  lastSkippedAt: null,
  lastSkipReason: null,
  lastSkippedOwnerId: null,
  updatedAt: now
});
var syncState = (store) => {
  if (!store.readSyncState || !store.writeSyncState) throw new Error("AlertStore no dispone de estado de sincronizaci\xF3n");
  return { read: store.readSyncState.bind(store), write: store.writeSyncState.bind(store) };
};
async function skipped(store, mode, ownerId, active, options, reason = "already-running") {
  const at = nowIso3(options);
  const previous = await store.readSyncState?.("RASFF", mode) ?? emptyState3(mode, at);
  await store.recordSyncSkip?.("RASFF", mode, ownerId, at, reason);
  return {
    ...previous,
    status: "skipped",
    leaseOwnerId: active?.ownerId ?? null,
    leaseMode: active?.mode ?? null,
    leaseExpiresAt: active?.expiresAt ?? null,
    lastSkippedAt: at,
    lastSkipReason: reason,
    lastSkippedOwnerId: ownerId,
    updatedAt: at
  };
}
var runningState = (previous, mode, startedAt, ownerId, expiresAt) => ({
  ...previous,
  source: "RASFF",
  mode,
  status: "running",
  startedAt,
  lastError: null,
  leaseOwnerId: ownerId,
  leaseMode: mode,
  leaseExpiresAt: expiresAt,
  updatedAt: startedAt
});
var failedState = (running, error, at) => ({
  ...running,
  status: "failed",
  pageErrors: running.pageErrors + 1,
  lastError: errorMessage3(error),
  leaseOwnerId: null,
  leaseMode: null,
  leaseExpiresAt: null,
  updatedAt: at
});
async function runRasffRecentSync(store, client = {}, options = {}) {
  const sync = syncState(store);
  const lease = await acquireSourceLease(store, "RASFF", "recent", options);
  if (!lease.acquired) return skipped(store, "recent", lease.ownerId, lease.lease, options);
  try {
    const startedAt = nowIso3(options);
    const previous = await sync.read("RASFF", "recent") ?? emptyState3("recent", startedAt);
    const running = runningState({ ...previous, totalUnits: 1 }, "recent", startedAt, lease.ownerId, lease.lease.expiresAt);
    await sync.write(running);
    try {
      const fetched = await fetchRasffRecent(previous.cursorKey ?? null, {
        ...client,
        onDetailBatch: async (processed) => {
          await client.onDetailBatch?.(processed);
          const renewed2 = await lease.renew();
          running.leaseExpiresAt = renewed2.expiresAt;
        }
      }, startedAt);
      const renewed = await lease.renew();
      running.leaseExpiresAt = renewed.expiresAt;
      await sync.write(running);
      const persisted = await store.persistSuccess("RASFF", fetched.alerts, { ownerId: lease.ownerId, now: () => nowIso3(options) });
      await lease.renew();
      const completedAt = nowIso3(options);
      const state = {
        ...running,
        status: fetched.hasMore || fetched.detailFailures ? "partial" : "completed",
        cursor: 0,
        cursorKey: fetched.nextCursorKey,
        totalUnits: 1,
        pagesScanned: fetched.pagesScanned,
        recordsObserved: fetched.recordsObserved,
        recordsPersisted: (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
        newCount: persisted.newCount ?? 0,
        updatedCount: persisted.updatedCount ?? 0,
        detailFailures: fetched.detailFailures,
        oldestPublishedAt: fetched.oldestPublishedAt,
        newestPublishedAt: fetched.newestPublishedAt,
        coverage: "partial",
        lastSuccessAt: completedAt,
        completedAt: fetched.hasMore || fetched.detailFailures ? null : completedAt,
        lastError: deferredSummary(fetched.detailFailures) ?? (fetched.hasMore ? "Quedan publicaciones RASFF nuevas por alcanzar desde el ancla estable" : null),
        leaseOwnerId: null,
        leaseMode: null,
        leaseExpiresAt: null,
        updatedAt: completedAt
      };
      await sync.write(state);
      return { ...state, deferredDetails: fetched.deferredDetails };
    } catch (error) {
      const at = nowIso3(options);
      const failed = failedState(running, error, at);
      if (!(error instanceof SyncLeaseLostError)) {
        try {
          await store.persistFailure("RASFF", error, { ownerId: lease.ownerId, now: () => nowIso3(options) });
        } catch {
        }
        await sync.write(failed);
      }
      return failed;
    }
  } finally {
    await lease.release();
  }
}
async function runRotatingLane(store, mode, requestedBatchSize, client, restart, options) {
  const sync = syncState(store);
  const lease = await acquireSourceLease(store, "RASFF", mode, options);
  if (!lease.acquired) return skipped(store, mode, lease.ownerId, lease.lease, options);
  try {
    const startedAt = nowIso3(options);
    const stored = restart ? null : await sync.read("RASFF", mode);
    if (mode === "backfill" && stored?.status === "completed" && !restart) return stored;
    const previous = !stored ? emptyState3(mode, startedAt) : mode === "reconcile" && stored.status === "completed" ? {
      ...emptyState3(mode, startedAt),
      lastSuccessAt: stored.completedAt ?? stored.lastSuccessAt,
      completedAt: stored.completedAt
    } : stored;
    if (previous.planVersion && previous.planVersion !== RASFF_RECONCILE_PLAN_VERSION) {
      const failed = failedState(previous, new Error(`Versi\xF3n de plan RASFF incompatible: ${previous.planVersion}`), startedAt);
      await sync.write(failed);
      return failed;
    }
    const maximum = mode === "backfill" ? RASFF_RECONCILE_MAX_BATCH_SIZE : 40;
    const batchSize = Math.max(1, Math.min(maximum, Math.trunc(requestedBatchSize)));
    const running = runningState(
      { ...previous, planVersion: RASFF_RECONCILE_PLAN_VERSION },
      mode,
      previous.startedAt ?? startedAt,
      lease.ownerId,
      lease.lease.expiresAt
    );
    running.updatedAt = startedAt;
    await sync.write(running);
    try {
      const fetched = await fetchRasffReconcileBatch(previous.cursor, previous.cursorKey ?? null, {
        ...client,
        onDetailBatch: async (processed) => {
          await client.onDetailBatch?.(processed);
          const renewed2 = await lease.renew();
          running.leaseExpiresAt = renewed2.expiresAt;
        }
      }, startedAt, batchSize);
      const renewed = await lease.renew();
      running.leaseExpiresAt = renewed.expiresAt;
      await sync.write(running);
      const persisted = await store.persistSuccess("RASFF", fetched.alerts, { ownerId: lease.ownerId, now: () => nowIso3(options) });
      await lease.renew();
      const completedAt = nowIso3(options);
      const completed = fetched.completedSweep && running.detailFailures + fetched.detailFailures === 0;
      const state = {
        ...running,
        status: completed ? "completed" : "partial",
        cursor: fetched.nextCursor,
        cursorKey: fetched.nextCursorKey,
        planVersion: RASFF_RECONCILE_PLAN_VERSION,
        totalUnits: fetched.totalElements,
        pagesScanned: running.pagesScanned + fetched.pagesScanned,
        recordsObserved: running.recordsObserved + fetched.processedCount,
        recordsPersisted: running.recordsPersisted + (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
        newCount: running.newCount + (persisted.newCount ?? 0),
        updatedCount: running.updatedCount + (persisted.updatedCount ?? 0),
        detailFailures: running.detailFailures + fetched.detailFailures,
        oldestPublishedAt: minDate3(running.oldestPublishedAt, fetched.oldestPublishedAt),
        newestPublishedAt: maxDate3(running.newestPublishedAt, fetched.newestPublishedAt),
        coverage: completed ? "official-index-complete" : "partial",
        lastSuccessAt: completedAt,
        // For a partial rotating sweep, retain the timestamp of the preceding
        // certified full sweep. It is deliberately separate from lastSuccessAt,
        // which advances after every successful batch.
        completedAt: completed ? completedAt : running.completedAt,
        lastError: deferredSummary(running.detailFailures + fetched.detailFailures),
        leaseOwnerId: null,
        leaseMode: null,
        leaseExpiresAt: null,
        updatedAt: completedAt
      };
      await sync.write(state);
      return { ...state, deferredDetails: fetched.deferredDetails };
    } catch (error) {
      const at = nowIso3(options);
      const failed = failedState(running, error, at);
      if (!(error instanceof SyncLeaseLostError)) {
        try {
          await store.persistFailure("RASFF", error, { ownerId: lease.ownerId, now: () => nowIso3(options) });
        } catch {
        }
        await sync.write(failed);
      }
      return failed;
    }
  } finally {
    await lease.release();
  }
}
var runRasffReconcileSync = (store, batchSize = 40, client = {}, options = {}) => runRotatingLane(store, "reconcile", batchSize, client, false, options);

// candidate-probe-v4-src/lib/oecd-snapshot.ts
var sourceData = (payload) => {
  const records = {
    alerts: [...payload.alerts].sort((a, b) => a.id.localeCompare(b.id)),
    versions: [...payload.versions].sort((a, b) => a.id - b.id),
    sourceChecks: [...payload.sourceChecks].sort((a, b) => a.id - b.id)
  };
  return payload.scope === "targeted" ? { ...records, scope: "targeted", targetIds: [...new Set(payload.targetIds ?? [])].sort(), sourceCheckMaxId: payload.sourceCheckMaxId ?? null } : { ...records, syncStates: [...payload.syncStates].sort((a, b) => a.mode.localeCompare(b.mode)) };
};
var oecdSourceDataChecksum = (payload) => sha256(sourceData(payload));
var snapshotStore = (store) => {
  if (!store.exportOecdSnapshot || !store.saveOecdSnapshot || !store.readOecdSnapshot || !store.findOecdSnapshot || !store.updateOecdSnapshotStatus || !store.restoreOecdSnapshot) throw new Error("AlertStore no dispone de snapshots OECD");
  return {
    exportData: store.exportOecdSnapshot.bind(store),
    save: store.saveOecdSnapshot.bind(store),
    read: store.readOecdSnapshot.bind(store),
    find: store.findOecdSnapshot.bind(store),
    update: store.updateOecdSnapshotStatus.bind(store),
    restore: store.restoreOecdSnapshot.bind(store)
  };
};
async function verifyOecdSnapshot(snapshot) {
  if (await sha256(snapshot.payload) !== snapshot.manifest.checksum || await oecdSourceDataChecksum(snapshot.payload) !== snapshot.manifest.sourceDataChecksum) {
    throw new Error(`El checksum del snapshot ${snapshot.manifest.id} no coincide`);
  }
  return snapshot;
}
async function verifyOecdReconciliationSnapshotForWrite(store, snapshotId, expectedTargetIds) {
  const persistence = snapshotStore(store);
  const snapshot = await persistence.read(snapshotId);
  if (!snapshot) throw new Error(`No existe el snapshot OECD ${snapshotId}`);
  await verifyOecdSnapshot(snapshot);
  if (snapshot.manifest.purpose !== "pre-reconciliation" || snapshot.manifest.status !== "ready" || snapshot.payload.scope !== "targeted" || !snapshot.payload.targetIds) {
    throw new Error(`El snapshot ${snapshotId} no est\xE1 READY para reconciliaci\xF3n OECD`);
  }
  const expected = [...new Set(expectedTargetIds)].sort();
  if (JSON.stringify(expected) !== JSON.stringify(snapshot.payload.targetIds)) {
    throw new Error("El conjunto OECD cambi\xF3 despu\xE9s del dry-run; cree un snapshot nuevo");
  }
  const live = await persistence.exportData(snapshot.payload.targetIds);
  const liveChecksum = await oecdSourceDataChecksum(live);
  if (liveChecksum !== snapshot.manifest.sourceDataChecksum) {
    throw new Error("Los datos OECD cambiaron despu\xE9s del snapshot; no se escribi\xF3 ning\xFAn registro");
  }
  return { snapshotId, sourceDataChecksum: liveChecksum, targetCount: expected.length, sourceMatches: true };
}
var completeOecdSnapshotBackfill = (store, snapshotId, at) => snapshotStore(store).update(snapshotId, "backfill-completed", at);

// verify/node_modules/fast-xml-parser/src/util.js
var nameStartChar = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
var nameChar = nameStartChar + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
var nameRegexp = "[" + nameStartChar + "][" + nameChar + "]*";
var regexName = new RegExp("^" + nameRegexp + "$");
function getAllMatches(string3, regex) {
  const matches = [];
  let match = regex.exec(string3);
  while (match) {
    const allmatches = [];
    allmatches.startIndex = regex.lastIndex - match[0].length;
    const len = match.length;
    for (let index2 = 0; index2 < len; index2++) {
      allmatches.push(match[index2]);
    }
    matches.push(allmatches);
    match = regex.exec(string3);
  }
  return matches;
}
var isName = function(string3) {
  const match = regexName.exec(string3);
  return !(match === null || typeof match === "undefined");
};
function isExist(v) {
  return typeof v !== "undefined";
}
var DANGEROUS_PROPERTY_NAMES = [
  // '__proto__',
  // 'constructor',
  // 'prototype',
  "hasOwnProperty",
  "toString",
  "valueOf",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__"
];
var criticalProperties = ["__proto__", "constructor", "prototype"];

// verify/node_modules/fast-xml-parser/src/validator.js
var defaultOptions = {
  allowBooleanAttributes: false,
  //A tag can have attributes without any value
  unpairedTags: []
};
function validate(xmlData, options) {
  options = Object.assign({}, defaultOptions, options);
  const tags = [];
  let tagFound = false;
  let reachedRoot = false;
  if (xmlData[0] === "\uFEFF") {
    xmlData = xmlData.substr(1);
  }
  for (let i = 0; i < xmlData.length; i++) {
    if (xmlData[i] === "<" && xmlData[i + 1] === "?") {
      i += 2;
      i = readPI(xmlData, i);
      if (i.err) return i;
    } else if (xmlData[i] === "<") {
      let tagStartPos = i;
      i++;
      if (xmlData[i] === "!") {
        i = readCommentAndCDATA(xmlData, i);
        continue;
      } else {
        let closingTag = false;
        if (xmlData[i] === "/") {
          closingTag = true;
          i++;
        }
        let tagName = "";
        for (; i < xmlData.length && xmlData[i] !== ">" && xmlData[i] !== " " && xmlData[i] !== "	" && xmlData[i] !== "\n" && xmlData[i] !== "\r"; i++) {
          tagName += xmlData[i];
        }
        tagName = tagName.trim();
        if (tagName[tagName.length - 1] === "/") {
          tagName = tagName.substring(0, tagName.length - 1);
          i--;
        }
        if (!validateTagName(tagName)) {
          let msg;
          if (tagName.trim().length === 0) {
            msg = "Invalid space after '<'.";
          } else {
            msg = "Tag '" + tagName + "' is an invalid name.";
          }
          return getErrorObject("InvalidTag", msg, getLineNumberForPosition(xmlData, i));
        }
        const result = readAttributeStr(xmlData, i);
        if (result === false) {
          return getErrorObject("InvalidAttr", "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i));
        }
        let attrStr = result.value;
        i = result.index;
        if (attrStr[attrStr.length - 1] === "/") {
          const attrStrStart = i - attrStr.length;
          attrStr = attrStr.substring(0, attrStr.length - 1);
          const isValid = validateAttributeString(attrStr, options);
          if (isValid === true) {
            tagFound = true;
          } else {
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
          }
        } else if (closingTag) {
          if (!result.tagClosed) {
            return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
          } else if (attrStr.trim().length > 0) {
            return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
          } else if (tags.length === 0) {
            return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
          } else {
            const otg = tags.pop();
            if (tagName !== otg.tagName) {
              let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
              return getErrorObject(
                "InvalidTag",
                "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.",
                getLineNumberForPosition(xmlData, tagStartPos)
              );
            }
            if (tags.length == 0) {
              reachedRoot = true;
            }
          }
        } else {
          const isValid = validateAttributeString(attrStr, options);
          if (isValid !== true) {
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
          }
          if (reachedRoot === true) {
            return getErrorObject("InvalidXml", "Multiple possible root nodes found.", getLineNumberForPosition(xmlData, i));
          } else if (options.unpairedTags.indexOf(tagName) !== -1) {
          } else {
            tags.push({ tagName, tagStartPos });
          }
          tagFound = true;
        }
        for (i++; i < xmlData.length; i++) {
          if (xmlData[i] === "<") {
            if (xmlData[i + 1] === "!") {
              i++;
              i = readCommentAndCDATA(xmlData, i);
              continue;
            } else if (xmlData[i + 1] === "?") {
              i = readPI(xmlData, ++i);
              if (i.err) return i;
            } else {
              break;
            }
          } else if (xmlData[i] === "&") {
            const afterAmp = validateAmpersand(xmlData, i);
            if (afterAmp == -1)
              return getErrorObject("InvalidChar", "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
            i = afterAmp;
          } else {
            if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
              return getErrorObject("InvalidXml", "Extra text at the end", getLineNumberForPosition(xmlData, i));
            }
          }
        }
        if (xmlData[i] === "<") {
          i--;
        }
      }
    } else {
      if (isWhiteSpace(xmlData[i])) {
        continue;
      }
      return getErrorObject("InvalidChar", "char '" + xmlData[i] + "' is not expected.", getLineNumberForPosition(xmlData, i));
    }
  }
  if (!tagFound) {
    return getErrorObject("InvalidXml", "Start tag expected.", 1);
  } else if (tags.length == 1) {
    return getErrorObject("InvalidTag", "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
  } else if (tags.length > 0) {
    return getErrorObject("InvalidXml", "Invalid '" + JSON.stringify(tags.map((t) => t.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 });
  }
  return true;
}
function isWhiteSpace(char) {
  return char === " " || char === "	" || char === "\n" || char === "\r";
}
function readPI(xmlData, i) {
  const start = i;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] == "?" || xmlData[i] == " ") {
      const tagname = xmlData.substr(start, i - start);
      if (i > 5 && tagname === "xml") {
        return getErrorObject("InvalidXml", "XML declaration allowed only at the start of the document.", getLineNumberForPosition(xmlData, i));
      } else if (xmlData[i] == "?" && xmlData[i + 1] == ">") {
        i++;
        break;
      } else {
        continue;
      }
    }
  }
  return i;
}
function readCommentAndCDATA(xmlData, i) {
  if (xmlData.length > i + 5 && xmlData[i + 1] === "-" && xmlData[i + 2] === "-") {
    for (i += 3; i < xmlData.length; i++) {
      if (xmlData[i] === "-" && xmlData[i + 1] === "-" && xmlData[i + 2] === ">") {
        i += 2;
        break;
      }
    }
  } else if (xmlData.length > i + 8 && xmlData[i + 1] === "D" && xmlData[i + 2] === "O" && xmlData[i + 3] === "C" && xmlData[i + 4] === "T" && xmlData[i + 5] === "Y" && xmlData[i + 6] === "P" && xmlData[i + 7] === "E") {
    let angleBracketsCount = 1;
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === "<") {
        angleBracketsCount++;
      } else if (xmlData[i] === ">") {
        angleBracketsCount--;
        if (angleBracketsCount === 0) {
          break;
        }
      }
    }
  } else if (xmlData.length > i + 9 && xmlData[i + 1] === "[" && xmlData[i + 2] === "C" && xmlData[i + 3] === "D" && xmlData[i + 4] === "A" && xmlData[i + 5] === "T" && xmlData[i + 6] === "A" && xmlData[i + 7] === "[") {
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === "]" && xmlData[i + 1] === "]" && xmlData[i + 2] === ">") {
        i += 2;
        break;
      }
    }
  }
  return i;
}
var doubleQuote = '"';
var singleQuote = "'";
function readAttributeStr(xmlData, i) {
  let attrStr = "";
  let startChar = "";
  let tagClosed = false;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
      if (startChar === "") {
        startChar = xmlData[i];
      } else if (startChar !== xmlData[i]) {
      } else {
        startChar = "";
      }
    } else if (xmlData[i] === ">") {
      if (startChar === "") {
        tagClosed = true;
        break;
      }
    }
    attrStr += xmlData[i];
  }
  if (startChar !== "") {
    return false;
  }
  return {
    value: attrStr,
    index: i,
    tagClosed
  };
}
var validAttrStrRegxp = new RegExp(`(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`, "g");
function validateAttributeString(attrStr, options) {
  const matches = getAllMatches(attrStr, validAttrStrRegxp);
  const attrNames = {};
  for (let i = 0; i < matches.length; i++) {
    if (matches[i][1].length === 0) {
      return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' has no space in starting.", getPositionFromMatch(matches[i]));
    } else if (matches[i][3] !== void 0 && matches[i][4] === void 0) {
      return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' is without value.", getPositionFromMatch(matches[i]));
    } else if (matches[i][3] === void 0 && !options.allowBooleanAttributes) {
      return getErrorObject("InvalidAttr", "boolean attribute '" + matches[i][2] + "' is not allowed.", getPositionFromMatch(matches[i]));
    }
    const attrName = matches[i][2];
    if (!validateAttrName(attrName)) {
      return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i]));
    }
    if (!Object.prototype.hasOwnProperty.call(attrNames, attrName)) {
      attrNames[attrName] = 1;
    } else {
      return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i]));
    }
  }
  return true;
}
function validateNumberAmpersand(xmlData, i) {
  let re = /\d/;
  if (xmlData[i] === "x") {
    i++;
    re = /[\da-fA-F]/;
  }
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === ";")
      return i;
    if (!xmlData[i].match(re))
      break;
  }
  return -1;
}
function validateAmpersand(xmlData, i) {
  i++;
  if (xmlData[i] === ";")
    return -1;
  if (xmlData[i] === "#") {
    i++;
    return validateNumberAmpersand(xmlData, i);
  }
  let count = 0;
  for (; i < xmlData.length; i++, count++) {
    if (xmlData[i].match(/\w/) && count < 20)
      continue;
    if (xmlData[i] === ";")
      break;
    return -1;
  }
  return i;
}
function getErrorObject(code, message, lineNumber) {
  return {
    err: {
      code,
      msg: message,
      line: lineNumber.line || lineNumber,
      col: lineNumber.col
    }
  };
}
function validateAttrName(attrName) {
  return isName(attrName);
}
function validateTagName(tagname) {
  return isName(tagname);
}
function getLineNumberForPosition(xmlData, index2) {
  const lines = xmlData.substring(0, index2).split(/\r?\n/);
  return {
    line: lines.length,
    // column number is last line's length + 1, because column numbering starts at 1:
    col: lines[lines.length - 1].length + 1
  };
}
function getPositionFromMatch(match) {
  return match.startIndex + match[1].length;
}

// verify/node_modules/@nodable/entities/src/entities.js
var BASIC_LATIN = {
  amp: "&",
  AMP: "&",
  lt: "<",
  LT: "<",
  gt: ">",
  GT: ">",
  quot: '"',
  QUOT: '"',
  apos: "'",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquor: "\u201A",
  rsquor: "\u2019",
  ldquor: "\u201E",
  bdquo: "\u201E",
  comma: ",",
  period: ".",
  colon: ":",
  semi: ";",
  excl: "!",
  quest: "?",
  num: "#",
  dollar: "$",
  percent: "%",
  ast: "*",
  commat: "@",
  lowbar: "_",
  verbar: "|",
  vert: "|",
  sol: "/",
  bsol: "\\",
  lbrace: "{",
  rbrace: "}",
  lbrack: "[",
  rbrack: "]",
  lpar: "(",
  rpar: ")",
  nbsp: "\xA0",
  iexcl: "\xA1",
  cent: "\xA2",
  pound: "\xA3",
  curren: "\xA4",
  yen: "\xA5",
  brvbar: "\xA6",
  sect: "\xA7",
  uml: "\xA8",
  copy: "\xA9",
  COPY: "\xA9",
  ordf: "\xAA",
  laquo: "\xAB",
  not: "\xAC",
  shy: "\xAD",
  reg: "\xAE",
  REG: "\xAE",
  macr: "\xAF",
  deg: "\xB0",
  plusmn: "\xB1",
  sup2: "\xB2",
  sup3: "\xB3",
  acute: "\xB4",
  micro: "\xB5",
  para: "\xB6",
  middot: "\xB7",
  cedil: "\xB8",
  sup1: "\xB9",
  ordm: "\xBA",
  raquo: "\xBB",
  frac14: "\xBC",
  frac12: "\xBD",
  half: "\xBD",
  frac34: "\xBE",
  iquest: "\xBF",
  times: "\xD7",
  div: "\xF7",
  divide: "\xF7"
};
var LATIN_ACCENTS = {
  Agrave: "\xC0",
  agrave: "\xE0",
  Aacute: "\xC1",
  aacute: "\xE1",
  Acirc: "\xC2",
  acirc: "\xE2",
  Atilde: "\xC3",
  atilde: "\xE3",
  Auml: "\xC4",
  auml: "\xE4",
  Aring: "\xC5",
  aring: "\xE5",
  AElig: "\xC6",
  aelig: "\xE6",
  Ccedil: "\xC7",
  ccedil: "\xE7",
  Egrave: "\xC8",
  egrave: "\xE8",
  Eacute: "\xC9",
  eacute: "\xE9",
  Ecirc: "\xCA",
  ecirc: "\xEA",
  Euml: "\xCB",
  euml: "\xEB",
  Igrave: "\xCC",
  igrave: "\xEC",
  Iacute: "\xCD",
  iacute: "\xED",
  Icirc: "\xCE",
  icirc: "\xEE",
  Iuml: "\xCF",
  iuml: "\xEF",
  ETH: "\xD0",
  eth: "\xF0",
  Ntilde: "\xD1",
  ntilde: "\xF1",
  Ograve: "\xD2",
  ograve: "\xF2",
  Oacute: "\xD3",
  oacute: "\xF3",
  Ocirc: "\xD4",
  ocirc: "\xF4",
  Otilde: "\xD5",
  otilde: "\xF5",
  Ouml: "\xD6",
  ouml: "\xF6",
  Oslash: "\xD8",
  oslash: "\xF8",
  Ugrave: "\xD9",
  ugrave: "\xF9",
  Uacute: "\xDA",
  uacute: "\xFA",
  Ucirc: "\xDB",
  ucirc: "\xFB",
  Uuml: "\xDC",
  uuml: "\xFC",
  Yacute: "\xDD",
  yacute: "\xFD",
  THORN: "\xDE",
  thorn: "\xFE",
  szlig: "\xDF",
  yuml: "\xFF",
  Yuml: "\u0178"
};
var LATIN_EXTENDED = {
  Amacr: "\u0100",
  amacr: "\u0101",
  Abreve: "\u0102",
  abreve: "\u0103",
  Aogon: "\u0104",
  aogon: "\u0105",
  Cacute: "\u0106",
  cacute: "\u0107",
  Ccirc: "\u0108",
  ccirc: "\u0109",
  Cdot: "\u010A",
  cdot: "\u010B",
  Ccaron: "\u010C",
  ccaron: "\u010D",
  Dcaron: "\u010E",
  dcaron: "\u010F",
  Dstrok: "\u0110",
  dstrok: "\u0111",
  Emacr: "\u0112",
  emacr: "\u0113",
  Ecaron: "\u011A",
  ecaron: "\u011B",
  Edot: "\u0116",
  edot: "\u0117",
  Eogon: "\u0118",
  eogon: "\u0119",
  Gcirc: "\u011C",
  gcirc: "\u011D",
  Gbreve: "\u011E",
  gbreve: "\u011F",
  Gdot: "\u0120",
  gdot: "\u0121",
  Gcedil: "\u0122",
  Hcirc: "\u0124",
  hcirc: "\u0125",
  Hstrok: "\u0126",
  hstrok: "\u0127",
  Itilde: "\u0128",
  itilde: "\u0129",
  Imacr: "\u012A",
  imacr: "\u012B",
  Iogon: "\u012E",
  iogon: "\u012F",
  Idot: "\u0130",
  IJlig: "\u0132",
  ijlig: "\u0133",
  Jcirc: "\u0134",
  jcirc: "\u0135",
  Kcedil: "\u0136",
  kcedil: "\u0137",
  kgreen: "\u0138",
  Lacute: "\u0139",
  lacute: "\u013A",
  Lcedil: "\u013B",
  lcedil: "\u013C",
  Lcaron: "\u013D",
  lcaron: "\u013E",
  Lmidot: "\u013F",
  lmidot: "\u0140",
  Lstrok: "\u0141",
  lstrok: "\u0142",
  Nacute: "\u0143",
  nacute: "\u0144",
  Ncaron: "\u0147",
  ncaron: "\u0148",
  Ncedil: "\u0145",
  ncedil: "\u0146",
  ENG: "\u014A",
  eng: "\u014B",
  Omacr: "\u014C",
  omacr: "\u014D",
  Odblac: "\u0150",
  odblac: "\u0151",
  OElig: "\u0152",
  oelig: "\u0153",
  Racute: "\u0154",
  racute: "\u0155",
  Rcaron: "\u0158",
  rcaron: "\u0159",
  Rcedil: "\u0156",
  rcedil: "\u0157",
  Sacute: "\u015A",
  sacute: "\u015B",
  Scirc: "\u015C",
  scirc: "\u015D",
  Scedil: "\u015E",
  scedil: "\u015F",
  Scaron: "\u0160",
  scaron: "\u0161",
  Tcedil: "\u0162",
  tcedil: "\u0163",
  Tcaron: "\u0164",
  tcaron: "\u0165",
  Tstrok: "\u0166",
  tstrok: "\u0167",
  Utilde: "\u0168",
  utilde: "\u0169",
  Umacr: "\u016A",
  umacr: "\u016B",
  Ubreve: "\u016C",
  ubreve: "\u016D",
  Uring: "\u016E",
  uring: "\u016F",
  Udblac: "\u0170",
  udblac: "\u0171",
  Uogon: "\u0172",
  uogon: "\u0173",
  Wcirc: "\u0174",
  wcirc: "\u0175",
  Ycirc: "\u0176",
  ycirc: "\u0177",
  Zacute: "\u0179",
  zacute: "\u017A",
  Zdot: "\u017B",
  zdot: "\u017C",
  Zcaron: "\u017D",
  zcaron: "\u017E"
};
var GREEK = {
  Alpha: "\u0391",
  alpha: "\u03B1",
  Beta: "\u0392",
  beta: "\u03B2",
  Gamma: "\u0393",
  gamma: "\u03B3",
  Delta: "\u0394",
  delta: "\u03B4",
  Epsilon: "\u0395",
  epsilon: "\u03B5",
  epsiv: "\u03F5",
  varepsilon: "\u03F5",
  Zeta: "\u0396",
  zeta: "\u03B6",
  Eta: "\u0397",
  eta: "\u03B7",
  Theta: "\u0398",
  theta: "\u03B8",
  thetasym: "\u03D1",
  vartheta: "\u03D1",
  Iota: "\u0399",
  iota: "\u03B9",
  Kappa: "\u039A",
  kappa: "\u03BA",
  kappav: "\u03F0",
  varkappa: "\u03F0",
  Lambda: "\u039B",
  lambda: "\u03BB",
  Mu: "\u039C",
  mu: "\u03BC",
  Nu: "\u039D",
  nu: "\u03BD",
  Xi: "\u039E",
  xi: "\u03BE",
  Omicron: "\u039F",
  omicron: "\u03BF",
  Pi: "\u03A0",
  pi: "\u03C0",
  piv: "\u03D6",
  varpi: "\u03D6",
  Rho: "\u03A1",
  rho: "\u03C1",
  rhov: "\u03F1",
  varrho: "\u03F1",
  Sigma: "\u03A3",
  sigma: "\u03C3",
  sigmaf: "\u03C2",
  sigmav: "\u03C2",
  varsigma: "\u03C2",
  Tau: "\u03A4",
  tau: "\u03C4",
  Upsilon: "\u03A5",
  upsilon: "\u03C5",
  upsi: "\u03C5",
  Upsi: "\u03D2",
  upsih: "\u03D2",
  Phi: "\u03A6",
  phi: "\u03C6",
  phiv: "\u03D5",
  varphi: "\u03D5",
  Chi: "\u03A7",
  chi: "\u03C7",
  Psi: "\u03A8",
  psi: "\u03C8",
  Omega: "\u03A9",
  omega: "\u03C9",
  ohm: "\u03A9",
  Gammad: "\u03DC",
  gammad: "\u03DD",
  digamma: "\u03DD"
};
var CYRILLIC = {
  Afr: "\u{1D504}",
  afr: "\u{1D51E}",
  Acy: "\u0410",
  acy: "\u0430",
  Bcy: "\u0411",
  bcy: "\u0431",
  Vcy: "\u0412",
  vcy: "\u0432",
  Gcy: "\u0413",
  gcy: "\u0433",
  Dcy: "\u0414",
  dcy: "\u0434",
  IEcy: "\u0415",
  iecy: "\u0435",
  IOcy: "\u0401",
  iocy: "\u0451",
  ZHcy: "\u0416",
  zhcy: "\u0436",
  Zcy: "\u0417",
  zcy: "\u0437",
  Icy: "\u0418",
  icy: "\u0438",
  Jcy: "\u0419",
  jcy: "\u0439",
  Kcy: "\u041A",
  kcy: "\u043A",
  Lcy: "\u041B",
  lcy: "\u043B",
  Mcy: "\u041C",
  mcy: "\u043C",
  Ncy: "\u041D",
  ncy: "\u043D",
  Ocy: "\u041E",
  ocy: "\u043E",
  Pcy: "\u041F",
  pcy: "\u043F",
  Rcy: "\u0420",
  rcy: "\u0440",
  Scy: "\u0421",
  scy: "\u0441",
  Tcy: "\u0422",
  tcy: "\u0442",
  Ucy: "\u0423",
  ucy: "\u0443",
  Fcy: "\u0424",
  fcy: "\u0444",
  KHcy: "\u0425",
  khcy: "\u0445",
  TScy: "\u0426",
  tscy: "\u0446",
  CHcy: "\u0427",
  chcy: "\u0447",
  SHcy: "\u0428",
  shcy: "\u0448",
  SHCHcy: "\u0429",
  shchcy: "\u0449",
  HARDcy: "\u042A",
  hardcy: "\u044A",
  Ycy: "\u042B",
  ycy: "\u044B",
  SOFTcy: "\u042C",
  softcy: "\u044C",
  Ecy: "\u042D",
  ecy: "\u044D",
  YUcy: "\u042E",
  yucy: "\u044E",
  YAcy: "\u042F",
  yacy: "\u044F",
  DJcy: "\u0402",
  djcy: "\u0452",
  GJcy: "\u0403",
  gjcy: "\u0453",
  Jukcy: "\u0404",
  jukcy: "\u0454",
  DScy: "\u0405",
  dscy: "\u0455",
  Iukcy: "\u0406",
  iukcy: "\u0456",
  YIcy: "\u0407",
  yicy: "\u0457",
  Jsercy: "\u0408",
  jsercy: "\u0458",
  LJcy: "\u0409",
  ljcy: "\u0459",
  NJcy: "\u040A",
  njcy: "\u045A",
  TSHcy: "\u040B",
  tshcy: "\u045B",
  KJcy: "\u040C",
  kjcy: "\u045C",
  Ubrcy: "\u040E",
  ubrcy: "\u045E",
  DZcy: "\u040F",
  dzcy: "\u045F"
};
var MATH = {
  plus: "+",
  pm: "\xB1",
  times: "\xD7",
  div: "\xF7",
  divide: "\xF7",
  sdot: "\u22C5",
  star: "\u2606",
  starf: "\u2605",
  bigstar: "\u2605",
  lowast: "\u2217",
  ast: "*",
  midast: "*",
  compfn: "\u2218",
  smallcircle: "\u2218",
  bullet: "\u2022",
  bull: "\u2022",
  nbsp: "\xA0",
  hellip: "\u2026",
  mldr: "\u2026",
  prime: "\u2032",
  Prime: "\u2033",
  tprime: "\u2034",
  bprime: "\u2035",
  backprime: "\u2035",
  minus: "\u2212",
  minusd: "\u2238",
  dotminus: "\u2238",
  plusdo: "\u2214",
  dotplus: "\u2214",
  plusmn: "\xB1",
  minusplus: "\u2213",
  mnplus: "\u2213",
  mp: "\u2213",
  setminus: "\u2216",
  smallsetminus: "\u2216",
  Backslash: "\u2216",
  setmn: "\u2216",
  ssetmn: "\u2216",
  lowbar: "_",
  verbar: "|",
  vert: "|",
  VerticalLine: "|",
  colon: ":",
  Colon: "\u2237",
  Proportion: "\u2237",
  ratio: "\u2236",
  equals: "=",
  ne: "\u2260",
  nequiv: "\u2262",
  equiv: "\u2261",
  Congruent: "\u2261",
  sim: "\u223C",
  thicksim: "\u223C",
  thksim: "\u223C",
  sime: "\u2243",
  simeq: "\u2243",
  TildeEqual: "\u2243",
  asymp: "\u2248",
  approx: "\u2248",
  thickapprox: "\u2248",
  thkap: "\u2248",
  TildeTilde: "\u2248",
  ncong: "\u2247",
  cong: "\u2245",
  TildeFullEqual: "\u2245",
  asympeq: "\u224D",
  CupCap: "\u224D",
  bump: "\u224E",
  Bumpeq: "\u224E",
  HumpDownHump: "\u224E",
  bumpe: "\u224F",
  bumpeq: "\u224F",
  HumpEqual: "\u224F",
  le: "\u2264",
  LessEqual: "\u2264",
  ge: "\u2265",
  GreaterEqual: "\u2265",
  lesseqgtr: "\u22DA",
  lesseqqgtr: "\u2A8B",
  greater: ">",
  less: "<"
};
var MATH_ADVANCED = {
  alefsym: "\u2135",
  aleph: "\u2135",
  beth: "\u2136",
  gimel: "\u2137",
  daleth: "\u2138",
  forall: "\u2200",
  ForAll: "\u2200",
  part: "\u2202",
  PartialD: "\u2202",
  exist: "\u2203",
  Exists: "\u2203",
  nexist: "\u2204",
  nexists: "\u2204",
  empty: "\u2205",
  emptyset: "\u2205",
  emptyv: "\u2205",
  varnothing: "\u2205",
  nabla: "\u2207",
  Del: "\u2207",
  isin: "\u2208",
  isinv: "\u2208",
  in: "\u2208",
  Element: "\u2208",
  notin: "\u2209",
  notinva: "\u2209",
  ni: "\u220B",
  niv: "\u220B",
  SuchThat: "\u220B",
  ReverseElement: "\u220B",
  notni: "\u220C",
  notniva: "\u220C",
  prod: "\u220F",
  Product: "\u220F",
  coprod: "\u2210",
  Coproduct: "\u2210",
  sum: "\u2211",
  Sum: "\u2211",
  minus: "\u2212",
  mp: "\u2213",
  plusdo: "\u2214",
  dotplus: "\u2214",
  setminus: "\u2216",
  lowast: "\u2217",
  radic: "\u221A",
  Sqrt: "\u221A",
  prop: "\u221D",
  propto: "\u221D",
  Proportional: "\u221D",
  varpropto: "\u221D",
  infin: "\u221E",
  infintie: "\u29DD",
  ang: "\u2220",
  angle: "\u2220",
  angmsd: "\u2221",
  measuredangle: "\u2221",
  angsph: "\u2222",
  mid: "\u2223",
  VerticalBar: "\u2223",
  nmid: "\u2224",
  nsmid: "\u2224",
  npar: "\u2226",
  parallel: "\u2225",
  spar: "\u2225",
  nparallel: "\u2226",
  nspar: "\u2226",
  and: "\u2227",
  wedge: "\u2227",
  or: "\u2228",
  vee: "\u2228",
  cap: "\u2229",
  cup: "\u222A",
  int: "\u222B",
  Integral: "\u222B",
  conint: "\u222E",
  ContourIntegral: "\u222E",
  Conint: "\u222F",
  DoubleContourIntegral: "\u222F",
  Cconint: "\u2230",
  there4: "\u2234",
  therefore: "\u2234",
  Therefore: "\u2234",
  becaus: "\u2235",
  because: "\u2235",
  Because: "\u2235",
  ratio: "\u2236",
  Proportion: "\u2237",
  minusd: "\u2238",
  dotminus: "\u2238",
  mDDot: "\u223A",
  homtht: "\u223B",
  sim: "\u223C",
  bsimg: "\u223D",
  backsim: "\u223D",
  ac: "\u223E",
  mstpos: "\u223E",
  acd: "\u223F",
  VerticalTilde: "\u2240",
  wr: "\u2240",
  wreath: "\u2240",
  nsime: "\u2244",
  nsimeq: "\u2244",
  ncong: "\u2247",
  simne: "\u2246",
  ncongdot: "\u2A6D\u0338",
  ngsim: "\u2275",
  nsim: "\u2241",
  napprox: "\u2249",
  nap: "\u2249",
  ngeq: "\u2271",
  nge: "\u2271",
  nleq: "\u2270",
  nle: "\u2270",
  ngtr: "\u226F",
  ngt: "\u226F",
  nless: "\u226E",
  nlt: "\u226E",
  nprec: "\u2280",
  npr: "\u2280",
  nsucc: "\u2281",
  nsc: "\u2281"
};
var ARROWS = {
  larr: "\u2190",
  leftarrow: "\u2190",
  LeftArrow: "\u2190",
  uarr: "\u2191",
  uparrow: "\u2191",
  UpArrow: "\u2191",
  rarr: "\u2192",
  rightarrow: "\u2192",
  RightArrow: "\u2192",
  darr: "\u2193",
  downarrow: "\u2193",
  DownArrow: "\u2193",
  harr: "\u2194",
  leftrightarrow: "\u2194",
  LeftRightArrow: "\u2194",
  varr: "\u2195",
  updownarrow: "\u2195",
  UpDownArrow: "\u2195",
  nwarr: "\u2196",
  nwarrow: "\u2196",
  UpperLeftArrow: "\u2196",
  nearr: "\u2197",
  nearrow: "\u2197",
  UpperRightArrow: "\u2197",
  searr: "\u2198",
  searrow: "\u2198",
  LowerRightArrow: "\u2198",
  swarr: "\u2199",
  swarrow: "\u2199",
  LowerLeftArrow: "\u2199",
  lArr: "\u21D0",
  Leftarrow: "\u21D0",
  uArr: "\u21D1",
  Uparrow: "\u21D1",
  rArr: "\u21D2",
  Rightarrow: "\u21D2",
  dArr: "\u21D3",
  Downarrow: "\u21D3",
  hArr: "\u21D4",
  Leftrightarrow: "\u21D4",
  iff: "\u21D4",
  vArr: "\u21D5",
  Updownarrow: "\u21D5",
  lAarr: "\u21DA",
  Lleftarrow: "\u21DA",
  rAarr: "\u21DB",
  Rrightarrow: "\u21DB",
  lrarr: "\u21C6",
  leftrightarrows: "\u21C6",
  rlarr: "\u21C4",
  rightleftarrows: "\u21C4",
  lrhar: "\u21CB",
  leftrightharpoons: "\u21CB",
  ReverseEquilibrium: "\u21CB",
  rlhar: "\u21CC",
  rightleftharpoons: "\u21CC",
  Equilibrium: "\u21CC",
  udarr: "\u21C5",
  UpArrowDownArrow: "\u21C5",
  duarr: "\u21F5",
  DownArrowUpArrow: "\u21F5",
  llarr: "\u21C7",
  leftleftarrows: "\u21C7",
  rrarr: "\u21C9",
  rightrightarrows: "\u21C9",
  ddarr: "\u21CA",
  downdownarrows: "\u21CA",
  har: "\u21BD",
  lhard: "\u21BD",
  leftharpoondown: "\u21BD",
  lharu: "\u21BC",
  leftharpoonup: "\u21BC",
  rhard: "\u21C1",
  rightharpoondown: "\u21C1",
  rharu: "\u21C0",
  rightharpoonup: "\u21C0",
  lsh: "\u21B0",
  Lsh: "\u21B0",
  rsh: "\u21B1",
  Rsh: "\u21B1",
  ldsh: "\u21B2",
  rdsh: "\u21B3",
  hookleftarrow: "\u21A9",
  hookrightarrow: "\u21AA",
  mapstoleft: "\u21A4",
  mapstoup: "\u21A5",
  map: "\u21A6",
  mapsto: "\u21A6",
  mapstodown: "\u21A7",
  crarr: "\u21B5",
  nleftarrow: "\u219A",
  nleftrightarrow: "\u21AE",
  nrightarrow: "\u219B",
  nrarr: "\u219B",
  larrtl: "\u21A2",
  rarrtl: "\u21A3",
  leftarrowtail: "\u21A2",
  rightarrowtail: "\u21A3",
  twoheadleftarrow: "\u219E",
  twoheadrightarrow: "\u21A0",
  Larr: "\u219E",
  Rarr: "\u21A0",
  larrhk: "\u21A9",
  rarrhk: "\u21AA",
  larrlp: "\u21AB",
  looparrowleft: "\u21AB",
  rarrlp: "\u21AC",
  looparrowright: "\u21AC",
  harrw: "\u21AD",
  leftrightsquigarrow: "\u21AD",
  nrarrw: "\u219D\u0338",
  rarrw: "\u219D",
  rightsquigarrow: "\u219D",
  larrbfs: "\u291F",
  rarrbfs: "\u2920",
  nvHarr: "\u2904",
  nvlArr: "\u2902",
  nvrArr: "\u2903",
  larrfs: "\u291D",
  rarrfs: "\u291E",
  Map: "\u2905",
  larrsim: "\u2973",
  rarrsim: "\u2974",
  harrcir: "\u2948",
  Uarrocir: "\u2949",
  lurdshar: "\u294A",
  ldrdhar: "\u2967",
  ldrushar: "\u294B",
  rdldhar: "\u2969",
  lrhard: "\u296D",
  uharr: "\u21BE",
  uharl: "\u21BF",
  dharr: "\u21C2",
  dharl: "\u21C3",
  Uarr: "\u219F",
  Darr: "\u21A1",
  zigrarr: "\u21DD",
  nwArr: "\u21D6",
  neArr: "\u21D7",
  seArr: "\u21D8",
  swArr: "\u21D9",
  nharr: "\u21AE",
  nhArr: "\u21CE",
  nlarr: "\u219A",
  nlArr: "\u21CD",
  nrArr: "\u21CF",
  larrb: "\u21E4",
  LeftArrowBar: "\u21E4",
  rarrb: "\u21E5",
  RightArrowBar: "\u21E5"
};
var SHAPES = {
  square: "\u25A1",
  Square: "\u25A1",
  squ: "\u25A1",
  squf: "\u25AA",
  squarf: "\u25AA",
  blacksquar: "\u25AA",
  blacksquare: "\u25AA",
  FilledVerySmallSquare: "\u25AA",
  blk34: "\u2593",
  blk12: "\u2592",
  blk14: "\u2591",
  block: "\u2588",
  srect: "\u25AD",
  rect: "\u25AD",
  sdot: "\u22C5",
  sdotb: "\u22A1",
  dotsquare: "\u22A1",
  triangle: "\u25B5",
  tri: "\u25B5",
  trine: "\u25B5",
  utri: "\u25B5",
  triangledown: "\u25BF",
  dtri: "\u25BF",
  tridown: "\u25BF",
  triangleleft: "\u25C3",
  ltri: "\u25C3",
  triangleright: "\u25B9",
  rtri: "\u25B9",
  blacktriangle: "\u25B4",
  utrif: "\u25B4",
  blacktriangledown: "\u25BE",
  dtrif: "\u25BE",
  blacktriangleleft: "\u25C2",
  ltrif: "\u25C2",
  blacktriangleright: "\u25B8",
  rtrif: "\u25B8",
  loz: "\u25CA",
  lozenge: "\u25CA",
  blacklozenge: "\u29EB",
  lozf: "\u29EB",
  bigcirc: "\u25EF",
  xcirc: "\u25EF",
  circ: "\u02C6",
  Circle: "\u25CB",
  cir: "\u25CB",
  o: "\u25CB",
  bullet: "\u2022",
  bull: "\u2022",
  hellip: "\u2026",
  mldr: "\u2026",
  nldr: "\u2025",
  boxh: "\u2500",
  HorizontalLine: "\u2500",
  boxv: "\u2502",
  boxdr: "\u250C",
  boxdl: "\u2510",
  boxur: "\u2514",
  boxul: "\u2518",
  boxvr: "\u251C",
  boxvl: "\u2524",
  boxhd: "\u252C",
  boxhu: "\u2534",
  boxvh: "\u253C",
  boxH: "\u2550",
  boxV: "\u2551",
  boxdR: "\u2552",
  boxDr: "\u2553",
  boxDR: "\u2554",
  boxDl: "\u2555",
  boxdL: "\u2556",
  boxDL: "\u2557",
  boxuR: "\u2558",
  boxUr: "\u2559",
  boxUR: "\u255A",
  boxUl: "\u255C",
  boxuL: "\u255B",
  boxUL: "\u255D",
  boxvR: "\u255E",
  boxVr: "\u255F",
  boxVR: "\u2560",
  boxVl: "\u2562",
  boxvL: "\u2561",
  boxVL: "\u2563",
  boxHd: "\u2564",
  boxhD: "\u2565",
  boxHD: "\u2566",
  boxHu: "\u2567",
  boxhU: "\u2568",
  boxHU: "\u2569",
  boxvH: "\u256A",
  boxVh: "\u256B",
  boxVH: "\u256C"
};
var PUNCTUATION = {
  excl: "!",
  iexcl: "\xA1",
  brvbar: "\xA6",
  sect: "\xA7",
  uml: "\xA8",
  copy: "\xA9",
  ordf: "\xAA",
  laquo: "\xAB",
  not: "\xAC",
  shy: "\xAD",
  reg: "\xAE",
  macr: "\xAF",
  deg: "\xB0",
  plusmn: "\xB1",
  sup2: "\xB2",
  sup3: "\xB3",
  acute: "\xB4",
  micro: "\xB5",
  para: "\xB6",
  middot: "\xB7",
  cedil: "\xB8",
  sup1: "\xB9",
  ordm: "\xBA",
  raquo: "\xBB",
  frac14: "\xBC",
  frac12: "\xBD",
  frac34: "\xBE",
  iquest: "\xBF",
  nbsp: "\xA0",
  comma: ",",
  period: ".",
  colon: ":",
  semi: ";",
  vert: "|",
  Verbar: "\u2016",
  verbar: "|",
  dblac: "\u02DD",
  circ: "\u02C6",
  caron: "\u02C7",
  breve: "\u02D8",
  dot: "\u02D9",
  ring: "\u02DA",
  ogon: "\u02DB",
  tilde: "\u02DC",
  DiacriticalGrave: "`",
  DiacriticalAcute: "\xB4",
  DiacriticalTilde: "\u02DC",
  DiacriticalDot: "\u02D9",
  DiacriticalDoubleAcute: "\u02DD",
  grave: "`"
};
var CURRENCY = {
  cent: "\xA2",
  pound: "\xA3",
  curren: "\xA4",
  yen: "\xA5",
  euro: "\u20AC",
  dollar: "$",
  fnof: "\u0192",
  inr: "\u20B9",
  af: "\u060B",
  birr: "\u1265\u122D",
  peso: "\u20B1",
  rub: "\u20BD",
  won: "\u20A9",
  yuan: "\xA5",
  cedil: "\xB8"
};
var FRACTIONS = {
  frac12: "\xBD",
  half: "\xBD",
  frac13: "\u2153",
  frac14: "\xBC",
  frac15: "\u2155",
  frac16: "\u2159",
  frac18: "\u215B",
  frac23: "\u2154",
  frac25: "\u2156",
  frac34: "\xBE",
  frac35: "\u2157",
  frac38: "\u215C",
  frac45: "\u2158",
  frac56: "\u215A",
  frac58: "\u215D",
  frac78: "\u215E",
  frasl: "\u2044"
};
var MISC_SYMBOLS = {
  trade: "\u2122",
  TRADE: "\u2122",
  telrec: "\u2315",
  target: "\u2316",
  ulcorn: "\u231C",
  ulcorner: "\u231C",
  urcorn: "\u231D",
  urcorner: "\u231D",
  dlcorn: "\u231E",
  llcorner: "\u231E",
  drcorn: "\u231F",
  lrcorner: "\u231F",
  intercal: "\u22BA",
  intcal: "\u22BA",
  oplus: "\u2295",
  CirclePlus: "\u2295",
  ominus: "\u2296",
  CircleMinus: "\u2296",
  otimes: "\u2297",
  CircleTimes: "\u2297",
  osol: "\u2298",
  odot: "\u2299",
  CircleDot: "\u2299",
  oast: "\u229B",
  circledast: "\u229B",
  odash: "\u229D",
  circleddash: "\u229D",
  ocirc: "\u229A",
  circledcirc: "\u229A",
  boxplus: "\u229E",
  plusb: "\u229E",
  boxminus: "\u229F",
  minusb: "\u229F",
  boxtimes: "\u22A0",
  timesb: "\u22A0",
  boxdot: "\u22A1",
  sdotb: "\u22A1",
  veebar: "\u22BB",
  vee: "\u2228",
  barvee: "\u22BD",
  and: "\u2227",
  wedge: "\u2227",
  Cap: "\u22D2",
  Cup: "\u22D3",
  Fork: "\u22D4",
  pitchfork: "\u22D4",
  epar: "\u22D5",
  ltlarr: "\u2976",
  nvap: "\u224D\u20D2",
  nvsim: "\u223C\u20D2",
  nvge: "\u2265\u20D2",
  nvle: "\u2264\u20D2",
  nvlt: "<\u20D2",
  nvgt: ">\u20D2",
  nvltrie: "\u22B4\u20D2",
  nvrtrie: "\u22B5\u20D2",
  Vdash: "\u22A9",
  dashv: "\u22A3",
  vDash: "\u22A8",
  Vvdash: "\u22AA",
  nvdash: "\u22AC",
  nvDash: "\u22AD",
  nVdash: "\u22AE",
  nVDash: "\u22AF"
};
var ALL_ENTITIES = {
  ...BASIC_LATIN,
  ...LATIN_ACCENTS,
  ...LATIN_EXTENDED,
  ...GREEK,
  ...CYRILLIC,
  ...MATH,
  ...MATH_ADVANCED,
  ...ARROWS,
  ...SHAPES,
  ...PUNCTUATION,
  ...CURRENCY,
  ...FRACTIONS,
  ...MISC_SYMBOLS
};
var XML = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"'
};
var COMMON_HTML = {
  nbsp: "\xA0",
  copy: "\xA9",
  reg: "\xAE",
  trade: "\u2122",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  laquo: "\xAB",
  raquo: "\xBB",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  bull: "\u2022",
  para: "\xB6",
  sect: "\xA7",
  deg: "\xB0",
  frac12: "\xBD",
  frac14: "\xBC",
  frac34: "\xBE"
};

// verify/node_modules/@nodable/entities/src/EntityDecoder.js
var ENTITY_ACTION = Object.freeze({
  /** Resolve and expand the entity normally. */
  ALLOW: "allow",
  /** Silently skip this entity — it will not be registered. */
  BLOCK: "block",
  /** Throw an error, aborting entity registration entirely. */
  THROW: "throw"
});
var SPECIAL_CHARS = new Set("!?\\\\/[]$%{}^&*()<>|+");
function validateEntityName(name) {
  if (name[0] === "#") {
    throw new Error(`[EntityReplacer] Invalid character '#' in entity name: "${name}"`);
  }
  for (const ch of name) {
    if (SPECIAL_CHARS.has(ch)) {
      throw new Error(`[EntityReplacer] Invalid character '${ch}' in entity name: "${name}"`);
    }
  }
  return name;
}
function mergeEntityMaps(...maps) {
  const out = /* @__PURE__ */ Object.create(null);
  for (const map of maps) {
    if (!map) continue;
    for (const key of Object.keys(map)) {
      const raw = map[key];
      if (typeof raw === "string") {
        out[key] = raw;
      } else if (raw && typeof raw === "object" && raw.val !== void 0) {
        const val = raw.val;
        if (typeof val === "string") {
          out[key] = val;
        }
      }
    }
  }
  return out;
}
var LIMIT_TIER_EXTERNAL = "external";
var LIMIT_TIER_BASE = "base";
var LIMIT_TIER_ALL = "all";
function parseLimitTiers(raw) {
  if (!raw || raw === LIMIT_TIER_EXTERNAL) return /* @__PURE__ */ new Set([LIMIT_TIER_EXTERNAL]);
  if (raw === LIMIT_TIER_ALL) return /* @__PURE__ */ new Set([LIMIT_TIER_ALL]);
  if (raw === LIMIT_TIER_BASE) return /* @__PURE__ */ new Set([LIMIT_TIER_BASE]);
  if (Array.isArray(raw)) return new Set(raw);
  return /* @__PURE__ */ new Set([LIMIT_TIER_EXTERNAL]);
}
var NCR_LEVEL = Object.freeze({ allow: 0, leave: 1, remove: 2, throw: 3 });
var XML10_ALLOWED_C0 = /* @__PURE__ */ new Set([9, 10, 13]);
function parseNCRConfig(ncr) {
  if (!ncr) {
    return { xmlVersion: 1, onLevel: NCR_LEVEL.allow, nullLevel: NCR_LEVEL.remove };
  }
  const xmlVersion = ncr.xmlVersion === 1.1 ? 1.1 : 1;
  const onLevel = NCR_LEVEL[ncr.onNCR] ?? NCR_LEVEL.allow;
  const nullLevel = NCR_LEVEL[ncr.nullNCR] ?? NCR_LEVEL.remove;
  const clampedNull = Math.max(nullLevel, NCR_LEVEL.remove);
  return { xmlVersion, onLevel, nullLevel: clampedNull };
}
var EntityDecoder = class {
  /**
   * @param {object} [options]
   * @param {object|null}  [options.namedEntities]        — extra named entities merged into base map
   * @param {object}  [options.limit]                 — security limits
   * @param {number}       [options.limit.maxTotalExpansions=0]  — 0 = unlimited
   * @param {number}       [options.limit.maxExpandedLength=0]   — 0 = unlimited
   * @param {'external'|'base'|'all'|string[]} [options.limit.applyLimitsTo='external']
   *   Which entity tiers count against the security limits:
   *   - 'external' (default) — only input/runtime + persistent external entities
   *   - 'base'               — only DEFAULT_XML_ENTITIES + namedEntities
   *   - 'all'                — every entity regardless of tier
   *   - string[]             — explicit combination, e.g. ['external', 'base']
   * @param {((resolved: string, original: string) => string)|null} [options.postCheck=null]
   * @param {string[]} [options.remove=[]] — entity names (e.g. ['nbsp', '#13']) to delete (replace with empty string)
   * @param {string[]} [options.leave=[]]  — entity names to keep as literal (unchanged in output)
   * @param {object}   [options.ncr]       — Numeric Character Reference controls
   * @param {1.0|1.1}  [options.ncr.xmlVersion=1.0]
   *   XML version governing which codepoint ranges are restricted:
   *   - 1.0 — C0 controls U+0001–U+001F (except U+0009/000A/000D) are prohibited
   *   - 1.1 — C0 controls are allowed when written as NCRs; C1 (U+007F–U+009F) decoded as-is
   * @param {'allow'|'leave'|'remove'|'throw'} [options.ncr.onNCR='allow']
   *   Base action for numeric references. Severity order: allow < leave < remove < throw.
   *   For codepoint ranges that carry a minimum level (surrogates → remove, XML 1.0 C0 → remove),
   *   the effective action is max(onNCR, rangeMinimum).
   * @param {'remove'|'throw'} [options.ncr.nullNCR='remove']
   *   Action for U+0000 (null). 'allow' and 'leave' are clamped to 'remove' since null is never safe.
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onExternalEntity=null]
   *   Hook called when an external entity is registered via `setExternalEntities()` or
   *   `addExternalEntity()`. Return `ENTITY_ACTION.ALLOW` to accept the entity,
   *   `ENTITY_ACTION.BLOCK` to silently skip it, or `ENTITY_ACTION.THROW` to abort with an error.
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onInputEntity=null]
   *   Hook called when an input entity is registered via `addInputEntities()`. Return
   *   `ENTITY_ACTION.ALLOW` to accept, `ENTITY_ACTION.BLOCK` to silently skip, or
   *   `ENTITY_ACTION.THROW` to abort with an error.
   */
  constructor(options = {}) {
    this._limit = options.limit || {};
    this._maxTotalExpansions = this._limit.maxTotalExpansions || 0;
    this._maxExpandedLength = this._limit.maxExpandedLength || 0;
    this._postCheck = typeof options.postCheck === "function" ? options.postCheck : (r) => r;
    this._limitTiers = parseLimitTiers(this._limit.applyLimitsTo ?? LIMIT_TIER_EXTERNAL);
    this._numericAllowed = options.numericAllowed ?? true;
    this._baseMap = mergeEntityMaps(XML, options.namedEntities || null);
    this._externalMap = /* @__PURE__ */ Object.create(null);
    this._inputMap = /* @__PURE__ */ Object.create(null);
    this._totalExpansions = 0;
    this._expandedLength = 0;
    this._removeSet = new Set(options.remove && Array.isArray(options.remove) ? options.remove : []);
    this._leaveSet = new Set(options.leave && Array.isArray(options.leave) ? options.leave : []);
    const ncrCfg = parseNCRConfig(options.ncr);
    this._ncrXmlVersion = ncrCfg.xmlVersion;
    this._ncrOnLevel = ncrCfg.onLevel;
    this._ncrNullLevel = ncrCfg.nullLevel;
    this._onExternalEntity = typeof options.onExternalEntity === "function" ? options.onExternalEntity : null;
    this._onInputEntity = typeof options.onInputEntity === "function" ? options.onInputEntity : null;
  }
  // -------------------------------------------------------------------------
  // Private: registration hook dispatch
  // -------------------------------------------------------------------------
  /**
   * Invoke a registration hook for a single entity name/value pair.
   * Returns true when the entity should be accepted, false when it should be
   * silently skipped (BLOCK), and throws when the hook returns THROW.
   *
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} hook
   * @param {string} name
   * @param {string} value
   * @param {string} context  — used in error messages ('external' | 'input')
   * @returns {boolean}  true = accept, false = skip
   */
  _applyRegistrationHook(hook, name, value, context) {
    if (!hook) return true;
    const action = hook(name, value);
    if (action === ENTITY_ACTION.BLOCK) return false;
    if (action === ENTITY_ACTION.THROW) {
      throw new Error(
        `[EntityDecoder] Registration of ${context} entity "&${name};" was rejected by hook`
      );
    }
    return true;
  }
  // -------------------------------------------------------------------------
  // Persistent external entity registration
  // -------------------------------------------------------------------------
  /**
   * Replace the full set of persistent external entities.
   * All keys are validated — throws on invalid characters.
   * If `onExternalEntity` is set, it is called once per entry; entries that
   * return `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW`
   * aborts the whole call.
   * @param {Record<string, string | { regex?: RegExp, val: string }>} map
   */
  setExternalEntities(map) {
    if (map) {
      for (const key of Object.keys(map)) {
        validateEntityName(key);
      }
    }
    if (!this._onExternalEntity) {
      this._externalMap = mergeEntityMaps(map);
      return;
    }
    const flat = mergeEntityMaps(map);
    const filtered = /* @__PURE__ */ Object.create(null);
    for (const [name, value] of Object.entries(flat)) {
      if (this._applyRegistrationHook(this._onExternalEntity, name, value, "external")) {
        filtered[name] = value;
      }
    }
    this._externalMap = filtered;
  }
  /**
   * Add a single persistent external entity.
   * If `onExternalEntity` is set it is called before the entity is stored;
   * `ENTITY_ACTION.BLOCK` silently skips storage, `ENTITY_ACTION.THROW` raises.
   * @param {string} key
   * @param {string} value
   */
  addExternalEntity(key, value) {
    validateEntityName(key);
    if (typeof value === "string" && value.indexOf("&") === -1) {
      if (this._applyRegistrationHook(this._onExternalEntity, key, value, "external")) {
        this._externalMap[key] = value;
      }
    }
  }
  // -------------------------------------------------------------------------
  // Input / runtime entity registration (per document)
  // -------------------------------------------------------------------------
  /**
   * Inject DOCTYPE entities for the current document.
   * Also resets per-document expansion counters.
   * If `onInputEntity` is set it is called once per entry; entries returning
   * `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW` aborts.
   * @param {Record<string, string | { regx?: RegExp, regex?: RegExp, val: string }>} map
   */
  addInputEntities(map) {
    this._totalExpansions = 0;
    this._expandedLength = 0;
    if (!this._onInputEntity) {
      this._inputMap = mergeEntityMaps(map);
      return;
    }
    const flat = mergeEntityMaps(map);
    const filtered = /* @__PURE__ */ Object.create(null);
    for (const [name, value] of Object.entries(flat)) {
      if (this._applyRegistrationHook(this._onInputEntity, name, value, "input")) {
        filtered[name] = value;
      }
    }
    this._inputMap = filtered;
  }
  // -------------------------------------------------------------------------
  // Per-document reset
  // -------------------------------------------------------------------------
  /**
   * Wipe input/runtime entities and reset counters.
   * Call this before processing each new document.
   * @returns {this}
   */
  reset() {
    this._inputMap = /* @__PURE__ */ Object.create(null);
    this._totalExpansions = 0;
    this._expandedLength = 0;
    return this;
  }
  // -------------------------------------------------------------------------
  // XML version (can be set after construction, e.g. once parser reads <?xml?>)
  // -------------------------------------------------------------------------
  /**
   * Update the XML version used for NCR classification.
   * Call this as soon as the document's `<?xml version="...">` declaration is parsed.
   * @param {1.0|1.1|number} version
   */
  setXmlVersion(version2) {
    this._ncrXmlVersion = version2 === 1.1 ? 1.1 : 1;
  }
  // -------------------------------------------------------------------------
  // Primary API
  // -------------------------------------------------------------------------
  /**
   * Replace all entity references in `str` in a single pass.
   *
   * @param {string} str
   * @returns {string}
   */
  decode(str) {
    if (typeof str !== "string" || str.length === 0) return str;
    if (str.indexOf("&") === -1) return str;
    const original = str;
    const chunks = [];
    const len = str.length;
    let last = 0;
    let i = 0;
    const limitExpansions = this._maxTotalExpansions > 0;
    const limitLength = this._maxExpandedLength > 0;
    const checkLimits = limitExpansions || limitLength;
    while (i < len) {
      if (str.charCodeAt(i) !== 38) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < len && str.charCodeAt(j) !== 59 && j - i <= 32) j++;
      if (j >= len || str.charCodeAt(j) !== 59) {
        i++;
        continue;
      }
      const token = str.slice(i + 1, j);
      if (token.length === 0) {
        i++;
        continue;
      }
      let replacement;
      let tier;
      if (this._removeSet.has(token)) {
        replacement = "";
        if (tier === void 0) {
          tier = LIMIT_TIER_EXTERNAL;
        }
      } else if (this._leaveSet.has(token)) {
        i++;
        continue;
      } else if (token.charCodeAt(0) === 35) {
        const ncrResult = this._resolveNCR(token);
        if (ncrResult === void 0) {
          i++;
          continue;
        }
        replacement = ncrResult;
        tier = LIMIT_TIER_BASE;
      } else {
        const resolved = this._resolveName(token);
        replacement = resolved?.value;
        tier = resolved?.tier;
      }
      if (replacement === void 0) {
        i++;
        continue;
      }
      if (i > last) chunks.push(str.slice(last, i));
      chunks.push(replacement);
      last = j + 1;
      i = last;
      if (checkLimits && this._tierCounts(tier)) {
        if (limitExpansions) {
          this._totalExpansions++;
          if (this._totalExpansions > this._maxTotalExpansions) {
            throw new Error(
              `[EntityReplacer] Entity expansion count limit exceeded: ${this._totalExpansions} > ${this._maxTotalExpansions}`
            );
          }
        }
        if (limitLength) {
          const delta = replacement.length - (token.length + 2);
          if (delta > 0) {
            this._expandedLength += delta;
            if (this._expandedLength > this._maxExpandedLength) {
              throw new Error(
                `[EntityReplacer] Expanded content length limit exceeded: ${this._expandedLength} > ${this._maxExpandedLength}`
              );
            }
          }
        }
      }
    }
    if (last < len) chunks.push(str.slice(last));
    const result = chunks.length === 0 ? str : chunks.join("");
    return this._postCheck(result, original);
  }
  // -------------------------------------------------------------------------
  // Private: limit tier check
  // -------------------------------------------------------------------------
  /**
   * Returns true if a resolved entity of the given tier should count
   * against the expansion/length limits.
   * @param {string} tier  — LIMIT_TIER_EXTERNAL | LIMIT_TIER_BASE
   * @returns {boolean}
   */
  _tierCounts(tier) {
    if (this._limitTiers.has(LIMIT_TIER_ALL)) return true;
    return this._limitTiers.has(tier);
  }
  // -------------------------------------------------------------------------
  // Private: entity resolution
  // -------------------------------------------------------------------------
  /**
   * Resolve a named entity token (without & and ;).
   * Priority: inputMap > externalMap > baseMap
   * Returns the resolved value tagged with its limit tier.
   *
   * @param {string} name
   * @returns {{ value: string, tier: string }|undefined}
   */
  _resolveName(name) {
    if (name in this._inputMap) return { value: this._inputMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._externalMap) return { value: this._externalMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._baseMap) return { value: this._baseMap[name], tier: LIMIT_TIER_BASE };
    return void 0;
  }
  /**
   * Classify a codepoint and return the minimum action level that must be applied.
   * Returns -1 when no minimum is imposed (normal allow path).
   *
   * Ranges checked (in priority order):
   *   1. U+0000            — null, governed by nullNCR (always ≥ remove)
   *   2. U+D800–U+DFFF     — surrogates, always prohibited (min: remove)
   *   3. U+0001–U+001F \ {0x09,0x0A,0x0D}  — XML 1.0 restricted C0 (min: remove)
   *      (skipped in XML 1.1 — C0 controls are allowed when written as NCRs)
   *
   * @param {number} cp  — codepoint
   * @returns {number}   — minimum NCR_LEVEL value, or -1 for no restriction
   */
  _classifyNCR(cp) {
    if (cp === 0) return this._ncrNullLevel;
    if (cp >= 55296 && cp <= 57343) return NCR_LEVEL.remove;
    if (this._ncrXmlVersion === 1) {
      if (cp >= 1 && cp <= 31 && !XML10_ALLOWED_C0.has(cp)) return NCR_LEVEL.remove;
    }
    return -1;
  }
  /**
   * Execute a resolved NCR action.
   *
   * @param {number} action   — NCR_LEVEL value
   * @param {string} token    — raw token (e.g. '#38') for error messages
   * @param {number} cp       — codepoint, used only for error messages
   * @returns {string|undefined}
   *   - decoded character string  → 'allow'
   *   - ''                        → 'remove'
   *   - undefined                 → 'leave' (caller must skip past '&' only)
   *   - throws Error              → 'throw'
   */
  _applyNCRAction(action, token, cp) {
    switch (action) {
      case NCR_LEVEL.allow:
        return String.fromCodePoint(cp);
      case NCR_LEVEL.remove:
        return "";
      case NCR_LEVEL.leave:
        return void 0;
      // signal: keep literal
      case NCR_LEVEL.throw:
        throw new Error(
          `[EntityDecoder] Prohibited numeric character reference &${token}; (U+${cp.toString(16).toUpperCase().padStart(4, "0")})`
        );
      default:
        return String.fromCodePoint(cp);
    }
  }
  /**
   * Full NCR resolution pipeline for a numeric token.
   *
   * Steps:
   *   1. Parse the codepoint (decimal or hex).
   *   2. Validate the raw codepoint range (NaN, <0, >0x10FFFF).
   *   3. If numericAllowed is false and no minimum restriction applies → leave as-is.
   *   4. Classify the codepoint to find the minimum required action level.
   *   5. Resolve effective action = max(onNCR, minimum).
   *   6. Apply and return.
   *
   * @param {string} token  — e.g. '#38', '#x26', '#X26'
   * @returns {string|undefined}
   *   - string (incl. '')  — replacement ('' = remove)
   *   - undefined          — leave original &token; as-is
   */
  _resolveNCR(token) {
    const second = token.charCodeAt(1);
    let cp;
    if (second === 120 || second === 88) {
      cp = parseInt(token.slice(2), 16);
    } else {
      cp = parseInt(token.slice(1), 10);
    }
    if (Number.isNaN(cp) || cp < 0 || cp > 1114111) return void 0;
    const minimum = this._classifyNCR(cp);
    if (!this._numericAllowed && minimum < NCR_LEVEL.remove) return void 0;
    const effective = minimum === -1 ? this._ncrOnLevel : Math.max(this._ncrOnLevel, minimum);
    return this._applyNCRAction(effective, token, cp);
  }
};

// verify/node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
var defaultOnDangerousProperty = (name) => {
  if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
    return "__" + name;
  }
  return name;
};
var defaultOptions2 = {
  preserveOrder: false,
  attributeNamePrefix: "@_",
  attributesGroupName: false,
  textNodeName: "#text",
  ignoreAttributes: true,
  removeNSPrefix: false,
  // remove NS from tag name or attribute name if true
  allowBooleanAttributes: false,
  //a tag can have attributes without any value
  //ignoreRootElement : false,
  parseTagValue: true,
  parseAttributeValue: false,
  trimValues: true,
  //Trim string values of tag and attributes
  cdataPropName: false,
  numberParseOptions: {
    hex: true,
    leadingZeros: true,
    eNotation: true
  },
  tagValueProcessor: function(tagName, val) {
    return val;
  },
  attributeValueProcessor: function(attrName, val) {
    return val;
  },
  stopNodes: [],
  //nested tags will not be parsed even for errors
  alwaysCreateTextNode: false,
  isArray: () => false,
  commentPropName: false,
  unpairedTags: [],
  processEntities: true,
  htmlEntities: false,
  entityDecoder: null,
  ignoreDeclaration: false,
  ignorePiTags: false,
  transformTagName: false,
  transformAttributeName: false,
  updateTag: function(tagName, jPath, attrs) {
    return tagName;
  },
  // skipEmptyListItem: false
  captureMetaData: false,
  maxNestedTags: 100,
  strictReservedNames: true,
  jPath: true,
  // if true, pass jPath string to callbacks; if false, pass matcher instance
  onDangerousProperty: defaultOnDangerousProperty
};
function validatePropertyName(propertyName, optionName) {
  if (typeof propertyName !== "string") {
    return;
  }
  const normalized = propertyName.toLowerCase();
  if (DANGEROUS_PROPERTY_NAMES.some((dangerous) => normalized === dangerous.toLowerCase())) {
    throw new Error(
      `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
    );
  }
  if (criticalProperties.some((dangerous) => normalized === dangerous.toLowerCase())) {
    throw new Error(
      `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
    );
  }
}
function normalizeProcessEntities(value, htmlEntities) {
  if (typeof value === "boolean") {
    return {
      enabled: value,
      // true or false
      maxEntitySize: 1e4,
      maxExpansionDepth: 1e4,
      maxTotalExpansions: Infinity,
      maxExpandedLength: 1e5,
      maxEntityCount: 1e3,
      allowedTags: null,
      tagFilter: null,
      appliesTo: "all"
    };
  }
  if (typeof value === "object" && value !== null) {
    return {
      enabled: value.enabled !== false,
      maxEntitySize: Math.max(1, value.maxEntitySize ?? 1e4),
      maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 1e4),
      maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
      maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 1e5),
      maxEntityCount: Math.max(1, value.maxEntityCount ?? 1e3),
      allowedTags: value.allowedTags ?? null,
      tagFilter: value.tagFilter ?? null,
      appliesTo: value.appliesTo ?? "all"
    };
  }
  return normalizeProcessEntities(true);
}
var buildOptions = function(options) {
  const built = Object.assign({}, defaultOptions2, options);
  const propertyNameOptions = [
    { value: built.attributeNamePrefix, name: "attributeNamePrefix" },
    { value: built.attributesGroupName, name: "attributesGroupName" },
    { value: built.textNodeName, name: "textNodeName" },
    { value: built.cdataPropName, name: "cdataPropName" },
    { value: built.commentPropName, name: "commentPropName" }
  ];
  for (const { value, name } of propertyNameOptions) {
    if (value) {
      validatePropertyName(value, name);
    }
  }
  if (built.onDangerousProperty === null) {
    built.onDangerousProperty = defaultOnDangerousProperty;
  }
  built.processEntities = normalizeProcessEntities(built.processEntities, built.htmlEntities);
  built.unpairedTagsSet = new Set(built.unpairedTags);
  if (built.stopNodes && Array.isArray(built.stopNodes)) {
    built.stopNodes = built.stopNodes.map((node) => {
      if (typeof node === "string" && node.startsWith("*.")) {
        return ".." + node.substring(2);
      }
      return node;
    });
  }
  return built;
};

// verify/node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
var METADATA_SYMBOL;
if (typeof Symbol !== "function") {
  METADATA_SYMBOL = "@@xmlMetadata";
} else {
  METADATA_SYMBOL = /* @__PURE__ */ Symbol("XML Node Metadata");
}
var XmlNode = class {
  constructor(tagname) {
    this.tagname = tagname;
    this.child = [];
    this[":@"] = /* @__PURE__ */ Object.create(null);
  }
  add(key, val) {
    if (key === "__proto__") key = "#__proto__";
    this.child.push({ [key]: val });
  }
  addChild(node, startIndex) {
    if (node.tagname === "__proto__") node.tagname = "#__proto__";
    if (node[":@"] && Object.keys(node[":@"]).length > 0) {
      this.child.push({ [node.tagname]: node.child, [":@"]: node[":@"] });
    } else {
      this.child.push({ [node.tagname]: node.child });
    }
    if (startIndex !== void 0) {
      this.child[this.child.length - 1][METADATA_SYMBOL] = { startIndex };
    }
  }
  /** symbol used for metadata */
  static getMetaDataSymbol() {
    return METADATA_SYMBOL;
  }
};

// verify/node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
var DocTypeReader = class {
  constructor(options) {
    this.suppressValidationErr = !options;
    this.options = options;
  }
  readDocType(xmlData, i) {
    const entities = /* @__PURE__ */ Object.create(null);
    let entityCount = 0;
    if (xmlData[i + 3] === "O" && xmlData[i + 4] === "C" && xmlData[i + 5] === "T" && xmlData[i + 6] === "Y" && xmlData[i + 7] === "P" && xmlData[i + 8] === "E") {
      i = i + 9;
      let angleBracketsCount = 1;
      let hasBody = false, comment = false;
      let exp = "";
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === "<" && !comment) {
          if (hasBody && hasSeq(xmlData, "!ENTITY", i)) {
            i += 7;
            let entityName, val;
            [entityName, val, i] = this.readEntityExp(xmlData, i + 1, this.suppressValidationErr);
            if (val.indexOf("&") === -1) {
              if (this.options.enabled !== false && this.options.maxEntityCount != null && entityCount >= this.options.maxEntityCount) {
                throw new Error(
                  `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                );
              }
              entities[entityName] = val;
              entityCount++;
            }
          } else if (hasBody && hasSeq(xmlData, "!ELEMENT", i)) {
            i += 8;
            const { index: index2 } = this.readElementExp(xmlData, i + 1);
            i = index2;
          } else if (hasBody && hasSeq(xmlData, "!ATTLIST", i)) {
            i += 8;
          } else if (hasBody && hasSeq(xmlData, "!NOTATION", i)) {
            i += 9;
            const { index: index2 } = this.readNotationExp(xmlData, i + 1, this.suppressValidationErr);
            i = index2;
          } else if (hasSeq(xmlData, "!--", i)) comment = true;
          else throw new Error(`Invalid DOCTYPE`);
          angleBracketsCount++;
          exp = "";
        } else if (xmlData[i] === ">") {
          if (comment) {
            if (xmlData[i - 1] === "-" && xmlData[i - 2] === "-") {
              comment = false;
              angleBracketsCount--;
            }
          } else {
            angleBracketsCount--;
          }
          if (angleBracketsCount === 0) {
            break;
          }
        } else if (xmlData[i] === "[") {
          hasBody = true;
        } else {
          exp += xmlData[i];
        }
      }
      if (angleBracketsCount !== 0) {
        throw new Error(`Unclosed DOCTYPE`);
      }
    } else {
      throw new Error(`Invalid Tag instead of DOCTYPE`);
    }
    return { entities, i };
  }
  readEntityExp(xmlData, i) {
    i = skipWhitespace(xmlData, i);
    const startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i]) && xmlData[i] !== '"' && xmlData[i] !== "'") {
      i++;
    }
    let entityName = xmlData.substring(startIndex, i);
    validateEntityName2(entityName);
    i = skipWhitespace(xmlData, i);
    if (!this.suppressValidationErr) {
      if (xmlData.substring(i, i + 6).toUpperCase() === "SYSTEM") {
        throw new Error("External entities are not supported");
      } else if (xmlData[i] === "%") {
        throw new Error("Parameter entities are not supported");
      }
    }
    let entityValue = "";
    [i, entityValue] = this.readIdentifierVal(xmlData, i, "entity");
    if (this.options.enabled !== false && this.options.maxEntitySize != null && entityValue.length > this.options.maxEntitySize) {
      throw new Error(
        `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
      );
    }
    i--;
    return [entityName, entityValue, i];
  }
  readNotationExp(xmlData, i) {
    i = skipWhitespace(xmlData, i);
    const startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i])) {
      i++;
    }
    let notationName = xmlData.substring(startIndex, i);
    !this.suppressValidationErr && validateEntityName2(notationName);
    i = skipWhitespace(xmlData, i);
    const identifierType = xmlData.substring(i, i + 6).toUpperCase();
    if (!this.suppressValidationErr && identifierType !== "SYSTEM" && identifierType !== "PUBLIC") {
      throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
    }
    i += identifierType.length;
    i = skipWhitespace(xmlData, i);
    let publicIdentifier = null;
    let systemIdentifier = null;
    if (identifierType === "PUBLIC") {
      [i, publicIdentifier] = this.readIdentifierVal(xmlData, i, "publicIdentifier");
      i = skipWhitespace(xmlData, i);
      if (xmlData[i] === '"' || xmlData[i] === "'") {
        [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
      }
    } else if (identifierType === "SYSTEM") {
      [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
      if (!this.suppressValidationErr && !systemIdentifier) {
        throw new Error("Missing mandatory system identifier for SYSTEM notation");
      }
    }
    return { notationName, publicIdentifier, systemIdentifier, index: --i };
  }
  readIdentifierVal(xmlData, i, type) {
    let identifierVal = "";
    const startChar = xmlData[i];
    if (startChar !== '"' && startChar !== "'") {
      throw new Error(`Expected quoted string, found "${startChar}"`);
    }
    i++;
    const startIndex = i;
    while (i < xmlData.length && xmlData[i] !== startChar) {
      i++;
    }
    identifierVal = xmlData.substring(startIndex, i);
    if (xmlData[i] !== startChar) {
      throw new Error(`Unterminated ${type} value`);
    }
    i++;
    return [i, identifierVal];
  }
  readElementExp(xmlData, i) {
    i = skipWhitespace(xmlData, i);
    const startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i])) {
      i++;
    }
    let elementName = xmlData.substring(startIndex, i);
    if (!this.suppressValidationErr && !isName(elementName)) {
      throw new Error(`Invalid element name: "${elementName}"`);
    }
    i = skipWhitespace(xmlData, i);
    let contentModel = "";
    if (xmlData[i] === "E" && hasSeq(xmlData, "MPTY", i)) i += 4;
    else if (xmlData[i] === "A" && hasSeq(xmlData, "NY", i)) i += 2;
    else if (xmlData[i] === "(") {
      i++;
      const startIndex2 = i;
      while (i < xmlData.length && xmlData[i] !== ")") {
        i++;
      }
      contentModel = xmlData.substring(startIndex2, i);
      if (xmlData[i] !== ")") {
        throw new Error("Unterminated content model");
      }
    } else if (!this.suppressValidationErr) {
      throw new Error(`Invalid Element Expression, found "${xmlData[i]}"`);
    }
    return {
      elementName,
      contentModel: contentModel.trim(),
      index: i
    };
  }
  readAttlistExp(xmlData, i) {
    i = skipWhitespace(xmlData, i);
    let startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i])) {
      i++;
    }
    let elementName = xmlData.substring(startIndex, i);
    validateEntityName2(elementName);
    i = skipWhitespace(xmlData, i);
    startIndex = i;
    while (i < xmlData.length && !/\s/.test(xmlData[i])) {
      i++;
    }
    let attributeName = xmlData.substring(startIndex, i);
    if (!validateEntityName2(attributeName)) {
      throw new Error(`Invalid attribute name: "${attributeName}"`);
    }
    i = skipWhitespace(xmlData, i);
    let attributeType = "";
    if (xmlData.substring(i, i + 8).toUpperCase() === "NOTATION") {
      attributeType = "NOTATION";
      i += 8;
      i = skipWhitespace(xmlData, i);
      if (xmlData[i] !== "(") {
        throw new Error(`Expected '(', found "${xmlData[i]}"`);
      }
      i++;
      let allowedNotations = [];
      while (i < xmlData.length && xmlData[i] !== ")") {
        const startIndex2 = i;
        while (i < xmlData.length && xmlData[i] !== "|" && xmlData[i] !== ")") {
          i++;
        }
        let notation = xmlData.substring(startIndex2, i);
        notation = notation.trim();
        if (!validateEntityName2(notation)) {
          throw new Error(`Invalid notation name: "${notation}"`);
        }
        allowedNotations.push(notation);
        if (xmlData[i] === "|") {
          i++;
          i = skipWhitespace(xmlData, i);
        }
      }
      if (xmlData[i] !== ")") {
        throw new Error("Unterminated list of notations");
      }
      i++;
      attributeType += " (" + allowedNotations.join("|") + ")";
    } else {
      const startIndex2 = i;
      while (i < xmlData.length && !/\s/.test(xmlData[i])) {
        i++;
      }
      attributeType += xmlData.substring(startIndex2, i);
      const validTypes = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
      if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
        throw new Error(`Invalid attribute type: "${attributeType}"`);
      }
    }
    i = skipWhitespace(xmlData, i);
    let defaultValue = "";
    if (xmlData.substring(i, i + 8).toUpperCase() === "#REQUIRED") {
      defaultValue = "#REQUIRED";
      i += 8;
    } else if (xmlData.substring(i, i + 7).toUpperCase() === "#IMPLIED") {
      defaultValue = "#IMPLIED";
      i += 7;
    } else {
      [i, defaultValue] = this.readIdentifierVal(xmlData, i, "ATTLIST");
    }
    return {
      elementName,
      attributeName,
      attributeType,
      defaultValue,
      index: i
    };
  }
};
var skipWhitespace = (data, index2) => {
  while (index2 < data.length && /\s/.test(data[index2])) {
    index2++;
  }
  return index2;
};
function hasSeq(data, seq, i) {
  for (let j = 0; j < seq.length; j++) {
    if (seq[j] !== data[i + j + 1]) return false;
  }
  return true;
}
function validateEntityName2(name) {
  if (isName(name))
    return name;
  else
    throw new Error(`Invalid entity name ${name}`);
}

// verify/node_modules/anynum/digitTable.js
var SCRIPT_ZEROS = [
  // Basic Latin (ASCII) — included for completeness / pass-through
  48,
  // 0-9
  // Arabic scripts
  1632,
  // Arabic-Indic ٠١٢٣٤٥٦٧٨٩
  1776,
  // Extended Arabic-Indic (Urdu/Persian/Sindhi) ۰۱۲۳
  // Indic scripts
  2406,
  // Devanagari ०१२३४५६७८९
  2534,
  // Bengali ০১২৩৪৫৬৭৮৯
  2662,
  // Gurmukhi ੦੧੨੩੪੫੬੭੮੯
  2790,
  // Gujarati ૦૧૨૩૪૫૬૭૮૯
  2918,
  // Odia ୦୧୨୩୪୫୬୭୮୯
  3046,
  // Tamil ௦௧௨௩௪௫௬௭௮௯
  3174,
  // Telugu ౦౧౨౩౪౫౬౭౮౯
  3302,
  // Kannada ೦೧೨೩೪೫೬೭೮೯
  3430,
  // Malayalam ൦൧൨൩൪൫൬൭൮൯
  3558,
  // Sinhala Archaic ෦෧෨෩෪෫෬෭෮෯
  // Southeast Asian scripts
  3664,
  // Thai ๐๑๒๓๔๕๖๗๘๙
  3792,
  // Lao ໐໑໒໓໔໕໖໗໘໙
  3872,
  // Tibetan ༠༡༢༣༤༥༦༧༨༩
  4160,
  // Myanmar ၀၁၂၃၄၅၆၇၈၉
  4240,
  // Myanmar Shan ႐႑႒႓႔႕႖႗႘႙
  6112,
  // Khmer ០១២៣៤៥៦៧៨៩
  6160,
  // Mongolian ᠐᠑᠒᠓᠔᠕᠖᠗᠘᠙
  6470,
  // Limbu ᥆᥇᥈᥉᥊᥋᥌᥍᥎᥏
  6608,
  // New Tai Lue ᧐᧑᧒᧓᧔᧕᧖᧗᧘᧙
  6784,
  // Tai Tham Hora ᪀᪁᪂᪃᪄᪅᪆᪇᪈᪉
  6800,
  // Tai Tham Tham ᪐᪑᪒᪓᪔᪕᪖᪗᪘᪙
  6992,
  // Balinese ᭐᭑᭒᭓᭔᭕᭖᭗᭘᭙
  7088,
  // Sundanese ᮰᮱᮲᮳᮴᮵᮶᮷᮸᮹
  7232,
  // Lepcha ᱀᱁᱂᱃᱄᱅᱆᱇᱈᱉
  7248,
  // Ol Chiki ᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙
  // Fullwidth (CJK context)
  65296,
  // Fullwidth ０１２３４５６７８９
  // Mathematical digit variants (Unicode math block)
  120782,
  // Mathematical Bold
  120792,
  // Mathematical Double-Struck
  120802,
  // Mathematical Sans-Serif
  120812,
  // Mathematical Sans-Serif Bold
  120822,
  // Mathematical Monospace
  // Other scripts
  66720,
  // Osmanya 𐒠𐒡𐒢𐒣𐒤𐒥𐒦𐒧𐒨𐒩
  68912,
  // Hanifi Rohingya 𐴰𐴱𐴲𐴳𐴴𐴵𐴶𐴷𐴸𐴹
  69734,
  // Brahmi 𑁦𑁧𑁨𑁩𑁪𑁫𑁬𑁭𑁮𑁯
  69872,
  // Sora Sompeng 𑃰𑃱𑃲𑃳𑃴𑃵𑃶𑃷𑃸𑃹
  69942,
  // Chakma 𑄶𑄷𑄸𑄹𑄺𑄻𑄼𑄽𑄾𑄿
  70096,
  // Sharada 𑇐𑇑𑇒𑇓𑇔𑇕𑇖𑇗𑇘𑇙
  70384,
  // Khudawadi 𑋰𑋱𑋲𑋳𑋴𑋵𑋶𑋷𑋸𑋹
  70736,
  // Newa 𑑐𑑑𑑒𑑓𑑔𑑕𑑖𑑗𑑘𑑙
  70864,
  // Tirhuta 𑓐𑓑𑓒𑓓𑓔𑓕𑓖𑓗𑓘𑓙
  71248,
  // Modi 𑙐𑙑𑙒𑙓𑙔𑙕𑙖𑙗𑙘𑙙
  71360,
  // Takri 𑛀𑛁𑛂𑛃𑛄𑛅𑛆𑛇𑛈𑛉
  71472,
  // Ahom 𑜰𑜱𑜲𑜳𑜴𑜵𑜶𑜷𑜸𑜹
  71904,
  // Warang Citi 𑣠𑣡𑣢𑣣𑣤𑣥𑣦𑣧𑣨𑣩
  72016,
  // Dives Akuru 𑥐𑥑𑥒𑥓𑥔𑥕𑥖𑥗𑥘𑥙
  72688,
  // Khitan Small Script 𑯰𑯱𑯲𑯳𑯴𑯵𑯶𑯷𑯸𑯹
  72784,
  // Bhaiksuki 𑱐𑱑𑱒𑱓𑱔𑱕𑱖𑱗𑱘𑱙
  73040,
  // Masaram Gondi 𑵐𑵑𑵒𑵓𑵔𑵕𑵖𑵗𑵘𑵙
  73120,
  // Gunjala Gondi 𑶠𑶡𑶢𑶣𑶤𑶥𑶦𑶧𑶨𑶩
  73552,
  // Kawi 𑽐𑽑𑽒𑽓𑽔𑽕𑽖𑽗𑽘𑽙
  92768,
  // Mro 𖩠𖩡𖩢𖩣𖩤𖩥𖩦𖩧𖩨𖩩
  92864,
  // Tangsa 𖫀𖫁𖫂𖫃𖫄𖫅𖫆𖫇𖫈𖫉
  93008,
  // Pahawh Hmong 𖭐𖭑𖭒𖭓𖭔𖭕𖭖𖭗𖭘𖭙
  123200,
  // Nyiakeng Puachue Hmong 𞅀𞅁𞅂𞅃𞅄𞅅𞅆𞅇𞅈𞅉
  123632,
  // Wancho 𞋰𞋱𞋲𞋳𞋴𞋵𞋶𞋷𞋸𞋹
  124144,
  // Nag Mundari 𞓰𞓱𞓲𞓳𞓴𞓵𞓶𞓷𞓸𞓹
  125264,
  // Adlam 𞥐𞥑𞥒𞥓𞥔𞥕𞥖𞥗𞥘𞥙
  130032
  // Segmented digit symbols 🯰🯱🯲🯳🯴🯵🯶🯷🯸🯹
];
var NOT_DIGIT = 255;
var HIGH_MAP = /* @__PURE__ */ new Map();
var LOW_MAX = 65535;
var LOW_MIN = 1632;
var TABLE_OFFSET = LOW_MIN;
var TABLE_SIZE = LOW_MAX - LOW_MIN + 1;
var TABLE = new Uint8Array(TABLE_SIZE).fill(NOT_DIGIT);
for (const zero of SCRIPT_ZEROS) {
  for (let d = 0; d < 10; d++) {
    const cp = zero + d;
    if (cp <= LOW_MAX) {
      TABLE[cp - TABLE_OFFSET] = d;
    } else {
      HIGH_MAP.set(cp, d);
    }
  }
}

// verify/node_modules/anynum/anynum.js
var CHAR_0 = 48;
var CHAR_9 = 57;
var CHAR_MINUS = 45;
var MINUS_SET = /* @__PURE__ */ new Set([8722, 65293, 65123]);
function anynum(str) {
  if (typeof str !== "string") return str;
  const len = str.length;
  if (len === 0) return str;
  let firstHit = -1;
  for (let i = 0; i < len; i++) {
    const cc = str.charCodeAt(i);
    if (cc >= CHAR_0 && cc <= CHAR_9 || cc === CHAR_MINUS) continue;
    if (cc < TABLE_OFFSET) {
      if (MINUS_SET.has(cc)) {
        firstHit = i;
        break;
      }
      continue;
    }
    if (cc >= 55296 && cc <= 56319) {
      if (i + 1 < len) {
        const low = str.charCodeAt(i + 1);
        if (low >= 56320 && low <= 57343) {
          const cp = 65536 + (cc - 55296 << 10) + (low - 56320);
          if (HIGH_MAP.has(cp)) {
            firstHit = i;
            break;
          }
        }
      }
      continue;
    }
    if (TABLE[cc - TABLE_OFFSET] !== NOT_DIGIT || MINUS_SET.has(cc)) {
      firstHit = i;
      break;
    }
  }
  if (firstHit === -1) return str;
  const chars = [];
  if (firstHit > 0) chars.push(str.slice(0, firstHit));
  for (let i = firstHit; i < len; i++) {
    const cc = str.charCodeAt(i);
    if (cc >= CHAR_0 && cc <= CHAR_9 || cc === CHAR_MINUS) {
      chars.push(str[i]);
      continue;
    }
    if (cc < TABLE_OFFSET) {
      chars.push(MINUS_SET.has(cc) ? "-" : str[i]);
      continue;
    }
    if (cc >= 55296 && cc <= 56319) {
      if (i + 1 < len) {
        const low = str.charCodeAt(i + 1);
        if (low >= 56320 && low <= 57343) {
          const cp = 65536 + (cc - 55296 << 10) + (low - 56320);
          const d2 = HIGH_MAP.get(cp);
          if (d2 !== void 0) {
            chars.push(String.fromCharCode(d2 + 48));
            i++;
            continue;
          }
        }
      }
      chars.push(str[i]);
      continue;
    }
    if (MINUS_SET.has(cc)) {
      chars.push("-");
      continue;
    }
    const d = TABLE[cc - TABLE_OFFSET];
    chars.push(d !== NOT_DIGIT ? String.fromCharCode(d + 48) : str[i]);
  }
  return chars.join("");
}
var anynum_default = anynum;

// verify/node_modules/strnum/strnum.js
var hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
var binRegex = /^0b[01]+$/;
var octRegex = /^0o[0-7]+$/;
var numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
var consider = {
  hex: true,
  binary: false,
  octal: false,
  leadingZeros: true,
  decimalPoint: ".",
  eNotation: true,
  //skipLike: /regex/,
  infinity: "original",
  // "null", "infinity" (Infinity type), "string" ("Infinity" (the string literal))
  unicode: false
};
function toNumber(str, options = {}) {
  options = Object.assign({}, consider, options);
  if (!str || typeof str !== "string") return str;
  let trimmedStr = str.trim();
  if (trimmedStr.length === 0) return str;
  else if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
  else if (trimmedStr === "0") return 0;
  if (options.unicode) {
    trimmedStr = anynum_default(trimmedStr);
    if (trimmedStr === "0") return 0;
  }
  if (options.hex && hexRegex.test(trimmedStr)) {
    return parse_int(trimmedStr, 16);
  } else if (options.binary && binRegex.test(trimmedStr)) {
    return parse_int(trimmedStr, 2);
  } else if (options.octal && octRegex.test(trimmedStr)) {
    return parse_int(trimmedStr, 8);
  } else if (!isFinite(trimmedStr)) {
    return handleInfinity(str, Number(trimmedStr), options);
  } else if (trimmedStr.includes("e") || trimmedStr.includes("E")) {
    return resolveEnotation(str, trimmedStr, options);
  } else {
    const match = numRegex.exec(trimmedStr);
    if (match) {
      const sign = match[1] || "";
      const leadingZeros = match[2];
      let numTrimmedByZeros = trimZeros(match[3]);
      const decimalAdjacentToLeadingZeros = sign ? (
        // 0., -00., 000.
        str[leadingZeros.length + 1] === "."
      ) : str[leadingZeros.length] === ".";
      if (!options.leadingZeros && (leadingZeros.length > 1 || leadingZeros.length === 1 && !decimalAdjacentToLeadingZeros)) {
        return str;
      } else {
        const num = Number(trimmedStr);
        const parsedStr = String(num);
        if (num === 0) return num;
        if (parsedStr.search(/[eE]/) !== -1) {
          if (options.eNotation) return num;
          else return str;
        } else if (trimmedStr.indexOf(".") !== -1) {
          if (parsedStr === "0") return num;
          else if (parsedStr === numTrimmedByZeros) return num;
          else if (parsedStr === `${sign}${numTrimmedByZeros}`) return num;
          else return str;
        }
        let n = leadingZeros ? numTrimmedByZeros : trimmedStr;
        if (leadingZeros) {
          return n === parsedStr || sign + n === parsedStr ? num : str;
        } else {
          return n === parsedStr || n === sign + parsedStr ? num : str;
        }
      }
    } else {
      return str;
    }
  }
}
var eNotationRegx = /^([-+])?(0*)(\d*(\.\d*)?[eE][-\+]?\d+)$/;
function resolveEnotation(str, trimmedStr, options) {
  if (!options.eNotation) return str;
  const notation = trimmedStr.match(eNotationRegx);
  if (notation) {
    let sign = notation[1] || "";
    const eChar = notation[3].indexOf("e") === -1 ? "E" : "e";
    const leadingZeros = notation[2];
    const eAdjacentToLeadingZeros = sign ? (
      // 0E.
      str[leadingZeros.length + 1] === eChar
    ) : str[leadingZeros.length] === eChar;
    if (leadingZeros.length > 1 && eAdjacentToLeadingZeros) return str;
    else if (leadingZeros.length === 1 && (notation[3].startsWith(`.${eChar}`) || notation[3][0] === eChar)) {
      return Number(trimmedStr);
    } else if (leadingZeros.length > 0) {
      if (options.leadingZeros && !eAdjacentToLeadingZeros) {
        trimmedStr = (notation[1] || "") + notation[3];
        return Number(trimmedStr);
      } else return str;
    } else {
      return Number(trimmedStr);
    }
  } else {
    return str;
  }
}
function trimZeros(numStr) {
  if (numStr && numStr.indexOf(".") !== -1) {
    let end = numStr.length;
    while (end > 0 && numStr.charCodeAt(end - 1) === 48) end--;
    numStr = numStr.slice(0, end);
    if (numStr === ".") numStr = "0";
    else if (numStr[0] === ".") numStr = "0" + numStr;
    else if (numStr[numStr.length - 1] === ".") numStr = numStr.substring(0, numStr.length - 1);
    return numStr;
  }
  return numStr;
}
function parse_int(numStr, base) {
  const str = numStr.trim();
  if (base === 2 || base === 8) numStr = str.substring(2);
  if (parseInt) return parseInt(numStr, base);
  else if (Number.parseInt) return Number.parseInt(numStr, base);
  else if (window && window.parseInt) return window.parseInt(numStr, base);
  else throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
}
function handleInfinity(str, num, options) {
  const isPositive = num === Infinity;
  switch (options.infinity.toLowerCase()) {
    case "null":
      return null;
    case "infinity":
      return num;
    // Return Infinity or -Infinity
    case "string":
      return isPositive ? "Infinity" : "-Infinity";
    case "original":
    default:
      return str;
  }
}

// verify/node_modules/fast-xml-parser/src/ignoreAttributes.js
function getIgnoreAttributesFn(ignoreAttributes) {
  if (typeof ignoreAttributes === "function") {
    return ignoreAttributes;
  }
  if (Array.isArray(ignoreAttributes)) {
    return (attrName) => {
      for (const pattern of ignoreAttributes) {
        if (typeof pattern === "string" && attrName === pattern) {
          return true;
        }
        if (pattern instanceof RegExp && pattern.test(attrName)) {
          return true;
        }
      }
    };
  }
  return () => false;
}

// verify/node_modules/path-expression-matcher/src/Expression.js
var Expression = class {
  /**
   * Create a new Expression
   * @param {string} pattern - Pattern string (e.g., "root.users.user", "..user[id]")
   * @param {Object} options - Configuration options
   * @param {string} options.separator - Path separator (default: '.')
   */
  constructor(pattern, options = {}, data) {
    this.pattern = pattern;
    this.separator = options.separator || ".";
    this.segments = this._parse(pattern);
    this.data = data;
    this._hasDeepWildcard = this.segments.some((seg) => seg.type === "deep-wildcard");
    this._hasAttributeCondition = this.segments.some((seg) => seg.attrName !== void 0);
    this._hasPositionSelector = this.segments.some((seg) => seg.position !== void 0);
  }
  /**
   * Parse pattern string into segments
   * @private
   * @param {string} pattern - Pattern to parse
   * @returns {Array} Array of segment objects
   */
  _parse(pattern) {
    const segments = [];
    let i = 0;
    let currentPart = "";
    while (i < pattern.length) {
      if (pattern[i] === this.separator) {
        if (i + 1 < pattern.length && pattern[i + 1] === this.separator) {
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
            currentPart = "";
          }
          segments.push({ type: "deep-wildcard" });
          i += 2;
        } else {
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
          }
          currentPart = "";
          i++;
        }
      } else {
        currentPart += pattern[i];
        i++;
      }
    }
    if (currentPart.trim()) {
      segments.push(this._parseSegment(currentPart.trim()));
    }
    return segments;
  }
  /**
   * Parse a single segment
   * @private
   * @param {string} part - Segment string (e.g., "user", "ns::user", "user[id]", "ns::user:first")
   * @returns {Object} Segment object
   */
  _parseSegment(part) {
    const segment = { type: "tag" };
    let bracketContent = null;
    let withoutBrackets = part;
    const bracketMatch = part.match(/^([^\[]+)(\[[^\]]*\])(.*)$/);
    if (bracketMatch) {
      withoutBrackets = bracketMatch[1] + bracketMatch[3];
      if (bracketMatch[2]) {
        const content = bracketMatch[2].slice(1, -1);
        if (content) {
          bracketContent = content;
        }
      }
    }
    let namespace = void 0;
    let tagAndPosition = withoutBrackets;
    if (withoutBrackets.includes("::")) {
      const nsIndex = withoutBrackets.indexOf("::");
      namespace = withoutBrackets.substring(0, nsIndex).trim();
      tagAndPosition = withoutBrackets.substring(nsIndex + 2).trim();
      if (!namespace) {
        throw new Error(`Invalid namespace in pattern: ${part}`);
      }
    }
    let tag = void 0;
    let positionMatch = null;
    if (tagAndPosition.includes(":")) {
      const colonIndex = tagAndPosition.lastIndexOf(":");
      const tagPart = tagAndPosition.substring(0, colonIndex).trim();
      const posPart = tagAndPosition.substring(colonIndex + 1).trim();
      const isPositionKeyword = ["first", "last", "odd", "even"].includes(posPart) || /^nth\(\d+\)$/.test(posPart);
      if (isPositionKeyword) {
        tag = tagPart;
        positionMatch = posPart;
      } else {
        tag = tagAndPosition;
      }
    } else {
      tag = tagAndPosition;
    }
    if (!tag) {
      throw new Error(`Invalid segment pattern: ${part}`);
    }
    segment.tag = tag;
    if (namespace) {
      segment.namespace = namespace;
    }
    if (bracketContent) {
      if (bracketContent.includes("=")) {
        const eqIndex = bracketContent.indexOf("=");
        segment.attrName = bracketContent.substring(0, eqIndex).trim();
        segment.attrValue = bracketContent.substring(eqIndex + 1).trim();
      } else {
        segment.attrName = bracketContent.trim();
      }
    }
    if (positionMatch) {
      const nthMatch = positionMatch.match(/^nth\((\d+)\)$/);
      if (nthMatch) {
        segment.position = "nth";
        segment.positionValue = parseInt(nthMatch[1], 10);
      } else {
        segment.position = positionMatch;
      }
    }
    return segment;
  }
  /**
   * Get the number of segments
   * @returns {number}
   */
  get length() {
    return this.segments.length;
  }
  /**
   * Check if expression contains deep wildcard
   * @returns {boolean}
   */
  hasDeepWildcard() {
    return this._hasDeepWildcard;
  }
  /**
   * Check if expression has attribute conditions
   * @returns {boolean}
   */
  hasAttributeCondition() {
    return this._hasAttributeCondition;
  }
  /**
   * Check if expression has position selectors
   * @returns {boolean}
   */
  hasPositionSelector() {
    return this._hasPositionSelector;
  }
  /**
   * Get string representation
   * @returns {string}
   */
  toString() {
    return this.pattern;
  }
};

// verify/node_modules/path-expression-matcher/src/ExpressionSet.js
var ExpressionSet = class {
  constructor() {
    this._byDepthAndTag = /* @__PURE__ */ new Map();
    this._wildcardByDepth = /* @__PURE__ */ new Map();
    this._deepWildcards = [];
    this._deepByTerminalTag = /* @__PURE__ */ new Map();
    this._patterns = /* @__PURE__ */ new Set();
    this._sealed = false;
  }
  /**
   * Add an Expression to the set.
   * Duplicate patterns (same pattern string) are silently ignored.
   *
   * @param {import('./Expression.js').default} expression - A pre-constructed Expression instance
   * @returns {this} for chaining
   * @throws {TypeError} if called after seal()
   *
   * @example
   * set.add(new Expression('root.users.user'));
   * set.add(new Expression('..script'));
   */
  add(expression) {
    if (this._sealed) {
      throw new TypeError(
        "ExpressionSet is sealed. Create a new ExpressionSet to add more expressions."
      );
    }
    if (this._patterns.has(expression.pattern)) return this;
    this._patterns.add(expression.pattern);
    if (expression.hasDeepWildcard()) {
      const lastSeg2 = expression.segments[expression.segments.length - 1];
      if (lastSeg2 && lastSeg2.type !== "deep-wildcard" && lastSeg2.tag !== "*") {
        const tag2 = lastSeg2.tag;
        if (!this._deepByTerminalTag.has(tag2)) this._deepByTerminalTag.set(tag2, []);
        this._deepByTerminalTag.get(tag2).push(expression);
      } else {
        this._deepWildcards.push(expression);
      }
      return this;
    }
    const depth = expression.length;
    const lastSeg = expression.segments[expression.segments.length - 1];
    const tag = lastSeg?.tag;
    if (!tag || tag === "*") {
      if (!this._wildcardByDepth.has(depth)) this._wildcardByDepth.set(depth, []);
      this._wildcardByDepth.get(depth).push(expression);
    } else {
      const key = `${depth}:${tag}`;
      if (!this._byDepthAndTag.has(key)) this._byDepthAndTag.set(key, []);
      this._byDepthAndTag.get(key).push(expression);
    }
    return this;
  }
  /**
   * Add multiple expressions at once.
   *
   * @param {import('./Expression.js').default[]} expressions - Array of Expression instances
   * @returns {this} for chaining
   *
   * @example
   * set.addAll([
   *   new Expression('root.users.user'),
   *   new Expression('root.config.setting'),
   * ]);
   */
  addAll(expressions) {
    for (const expr of expressions) this.add(expr);
    return this;
  }
  /**
   * Check whether a pattern string is already present in the set.
   *
   * @param {import('./Expression.js').default} expression
   * @returns {boolean}
   */
  has(expression) {
    return this._patterns.has(expression.pattern);
  }
  /**
   * Number of expressions in the set.
   * @type {number}
   */
  get size() {
    return this._patterns.size;
  }
  /**
   * Seal the set against further modifications.
   * Useful to prevent accidental mutations after config is built.
   * Calling add() or addAll() on a sealed set throws a TypeError.
   *
   * @returns {this}
   */
  seal() {
    this._sealed = true;
    return this;
  }
  /**
   * Whether the set has been sealed.
   * @type {boolean}
   */
  get isSealed() {
    return this._sealed;
  }
  /**
   * Test whether the matcher's current path matches any expression in the set.
   *
   * Evaluation order (cheapest → most expensive):
   *  1. Exact depth + tag bucket  — O(1) lookup, typically 0–2 expressions
   *  2. Depth-only wildcard bucket — O(1) lookup, rare
   *  3. Deep-wildcard list         — always checked, but usually small
   *
   * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
   * @returns {boolean} true if any expression matches the current path
   *
   * @example
   * if (stopNodes.matchesAny(matcher)) {
   *   // handle stop node
   * }
   */
  matchesAny(matcher) {
    return this.findMatch(matcher) !== null;
  }
  /**
  * Find and return the first Expression that matches the matcher's current path.
  *
  * Uses the same evaluation order as matchesAny (cheapest → most expensive):
  *  1. Exact depth + tag bucket
  *  2. Depth-only wildcard bucket
  *  3. Deep-wildcard list
  *
  * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
  * @returns {import('./Expression.js').default | null} the first matching Expression, or null
  *
  * @example
  * const expr = stopNodes.findMatch(matcher);
  * if (expr) {
  *   // access expr.config, expr.pattern, etc.
  * }
  */
  findMatch(matcher) {
    const depth = matcher.getDepth();
    const tag = matcher.getCurrentTag();
    const exactKey = `${depth}:${tag}`;
    const exactBucket = this._byDepthAndTag.get(exactKey);
    if (exactBucket) {
      for (let i = 0; i < exactBucket.length; i++) {
        if (matcher.matches(exactBucket[i])) return exactBucket[i];
      }
    }
    const wildcardBucket = this._wildcardByDepth.get(depth);
    if (wildcardBucket) {
      for (let i = 0; i < wildcardBucket.length; i++) {
        if (matcher.matches(wildcardBucket[i])) return wildcardBucket[i];
      }
    }
    const deepBucket = this._deepByTerminalTag.get(tag);
    if (deepBucket) {
      for (let i = 0; i < deepBucket.length; i++) {
        if (matcher.matches(deepBucket[i])) return deepBucket[i];
      }
    }
    for (let i = 0; i < this._deepWildcards.length; i++) {
      if (matcher.matches(this._deepWildcards[i])) return this._deepWildcards[i];
    }
    return null;
  }
};

// verify/node_modules/path-expression-matcher/src/Matcher.js
var MatcherView = class {
  /**
   * @param {Matcher} matcher - The parent Matcher instance to read from.
   */
  constructor(matcher) {
    this._matcher = matcher;
  }
  /**
   * Get the path separator used by the parent matcher.
   * @returns {string}
   */
  get separator() {
    return this._matcher.separator;
  }
  /**
   * Get current tag name.
   * @returns {string|undefined}
   */
  getCurrentTag() {
    const path = this._matcher.path;
    return path.length > 0 ? path[path.length - 1].tag : void 0;
  }
  /**
   * Get current namespace.
   * @returns {string|undefined}
   */
  getCurrentNamespace() {
    const path = this._matcher.path;
    return path.length > 0 ? path[path.length - 1].namespace : void 0;
  }
  /**
   * Get current node's attribute value.
   * @param {string} attrName
   * @returns {*}
   */
  getAttrValue(attrName) {
    const path = this._matcher.path;
    if (path.length === 0) return void 0;
    return path[path.length - 1].values?.[attrName];
  }
  /**
   * Check if current node has an attribute.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAttr(attrName) {
    const path = this._matcher.path;
    if (path.length === 0) return false;
    const current = path[path.length - 1];
    return current.values !== void 0 && attrName in current.values;
  }
  /**
   * Get the value of a "kept" attribute from the nearest ancestor (or
   * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {*}
   */
  getAnyParentAttr(attrName) {
    return this._matcher.getAnyParentAttr(attrName);
  }
  /**
   * Check whether any ancestor (or the current node) kept the given
   * attribute via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAnyParentAttr(attrName) {
    return this._matcher.hasAnyParentAttr(attrName);
  }
  /**
   * Get current node's sibling position (child index in parent).
   * @returns {number}
   */
  getPosition() {
    const path = this._matcher.path;
    if (path.length === 0) return -1;
    return path[path.length - 1].position ?? 0;
  }
  /**
   * Get current node's repeat counter (occurrence count of this tag name).
   * @returns {number}
   */
  getCounter() {
    const path = this._matcher.path;
    if (path.length === 0) return -1;
    return path[path.length - 1].counter ?? 0;
  }
  /**
   * Get current node's sibling index (alias for getPosition).
   * @returns {number}
   * @deprecated Use getPosition() or getCounter() instead
   */
  getIndex() {
    return this.getPosition();
  }
  /**
   * Get current path depth.
   * @returns {number}
   */
  getDepth() {
    return this._matcher.path.length;
  }
  /**
   * Get path as string.
   * @param {string} [separator] - Optional separator (uses default if not provided)
   * @param {boolean} [includeNamespace=true]
   * @returns {string}
   */
  toString(separator, includeNamespace = true) {
    return this._matcher.toString(separator, includeNamespace);
  }
  /**
   * Get path as array of tag names.
   * @returns {string[]}
   */
  toArray() {
    return this._matcher.path.map((n) => n.tag);
  }
  /**
   * Match current path against an Expression.
   * @param {Expression} expression
   * @returns {boolean}
   */
  matches(expression) {
    return this._matcher.matches(expression);
  }
  /**
   * Match any expression in the given set against the current path.
   * @param {ExpressionSet} exprSet
   * @returns {boolean}
   */
  matchesAny(exprSet) {
    return exprSet.matchesAny(this._matcher);
  }
};
var Matcher = class {
  /**
   * Create a new Matcher.
   * @param {Object} [options={}]
   * @param {string} [options.separator='.'] - Default path separator
   */
  constructor(options = {}) {
    this.separator = options.separator || ".";
    this.path = [];
    this.siblingStacks = [];
    this._pathStringCache = null;
    this._view = new MatcherView(this);
    this._keptAttrs = [];
  }
  /**
   * Push a new tag onto the path.
   * @param {string} tagName
   * @param {Object|null} [attrValues=null]
   * @param {string|null} [namespace=null]
   * @param {Object|null} [options=null]
   * @param {string[]} [options.keep] - Names of attributes (from attrValues)
   */
  push(tagName, attrValues = null, namespace = null, options = null) {
    this._pathStringCache = null;
    if (this.path.length > 0) {
      this.path[this.path.length - 1].values = void 0;
    }
    const currentLevel = this.path.length;
    let level = this.siblingStacks[currentLevel];
    if (!level) {
      level = { counts: /* @__PURE__ */ new Map(), total: 0 };
      this.siblingStacks[currentLevel] = level;
    }
    const siblingKey = namespace ? `${namespace}:${tagName}` : tagName;
    const counter = level.counts.get(siblingKey) || 0;
    const position = level.total;
    level.counts.set(siblingKey, counter + 1);
    level.total++;
    const node = {
      tag: tagName,
      position,
      counter
    };
    if (namespace !== null && namespace !== void 0) {
      node.namespace = namespace;
    }
    if (attrValues !== null && attrValues !== void 0) {
      node.values = attrValues;
    }
    this.path.push(node);
    const depth = this.path.length;
    const keep = options !== null ? options.keep : null;
    if (keep !== null && keep !== void 0 && keep.length > 0 && attrValues) {
      for (let i = 0; i < keep.length; i++) {
        const name = keep[i];
        if (attrValues[name] !== void 0) {
          this._keptAttrs.push({ depth, name, value: attrValues[name] });
        }
      }
    }
  }
  /**
   * Pop the last tag from the path.
   * @returns {Object|undefined} The popped node
   */
  pop() {
    if (this.path.length === 0) return void 0;
    this._pathStringCache = null;
    const node = this.path.pop();
    if (this.siblingStacks.length > this.path.length + 1) {
      this.siblingStacks.length = this.path.length + 1;
    }
    const poppedDepth = this.path.length + 1;
    while (this._keptAttrs.length > 0 && this._keptAttrs[this._keptAttrs.length - 1].depth >= poppedDepth) {
      this._keptAttrs.pop();
    }
    return node;
  }
  /**
   * Update current node's attribute values.
   * Useful when attributes are parsed after push.
   * @param {Object} attrValues
   */
  updateCurrent(attrValues) {
    if (this.path.length > 0) {
      const current = this.path[this.path.length - 1];
      if (attrValues !== null && attrValues !== void 0) {
        current.values = attrValues;
      }
    }
  }
  /**
   * Get current tag name.
   * @returns {string|undefined}
   */
  getCurrentTag() {
    return this.path.length > 0 ? this.path[this.path.length - 1].tag : void 0;
  }
  /**
   * Get current namespace.
   * @returns {string|undefined}
   */
  getCurrentNamespace() {
    return this.path.length > 0 ? this.path[this.path.length - 1].namespace : void 0;
  }
  /**
   * Get current node's attribute value.
   * @param {string} attrName
   * @returns {*}
   */
  getAttrValue(attrName) {
    if (this.path.length === 0) return void 0;
    return this.path[this.path.length - 1].values?.[attrName];
  }
  /**
   * Check if current node has an attribute.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAttr(attrName) {
    if (this.path.length === 0) return false;
    const current = this.path[this.path.length - 1];
    return current.values !== void 0 && attrName in current.values;
  }
  /**
   * Get the value of a "kept" attribute from the nearest ancestor (or
   * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
   * Unlike getAttrValue(), this works regardless of how deep the path has
   * gone since the attribute was pushed — but only for attribute names that
   * were explicitly marked with `keep` at push time. Cost is proportional to
   * the number of currently-kept attributes (typically 0-3), not path depth.
   * @param {string} attrName
   * @returns {*} the value, or undefined if no ancestor kept this attribute
   */
  getAnyParentAttr(attrName) {
    const kept = this._keptAttrs;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].name === attrName) return kept[i].value;
    }
    return void 0;
  }
  /**
   * Check whether any ancestor (or the current node) kept the given
   * attribute via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAnyParentAttr(attrName) {
    const kept = this._keptAttrs;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].name === attrName) return true;
    }
    return false;
  }
  /**
   * Get current node's sibling position (child index in parent).
   * @returns {number}
   */
  getPosition() {
    if (this.path.length === 0) return -1;
    return this.path[this.path.length - 1].position ?? 0;
  }
  /**
   * Get current node's repeat counter (occurrence count of this tag name).
   * @returns {number}
   */
  getCounter() {
    if (this.path.length === 0) return -1;
    return this.path[this.path.length - 1].counter ?? 0;
  }
  /**
   * Get current node's sibling index (alias for getPosition).
   * @returns {number}
   * @deprecated Use getPosition() or getCounter() instead
   */
  getIndex() {
    return this.getPosition();
  }
  /**
   * Get current path depth.
   * @returns {number}
   */
  getDepth() {
    return this.path.length;
  }
  /**
   * Get path as string.
   * @param {string} [separator] - Optional separator (uses default if not provided)
   * @param {boolean} [includeNamespace=true]
   * @returns {string}
   */
  toString(separator, includeNamespace = true) {
    const sep = separator || this.separator;
    const isDefault = sep === this.separator && includeNamespace === true;
    if (isDefault) {
      if (this._pathStringCache !== null) {
        return this._pathStringCache;
      }
      const result = this.path.map(
        (n) => n.namespace ? `${n.namespace}:${n.tag}` : n.tag
      ).join(sep);
      this._pathStringCache = result;
      return result;
    }
    return this.path.map(
      (n) => includeNamespace && n.namespace ? `${n.namespace}:${n.tag}` : n.tag
    ).join(sep);
  }
  /**
   * Get path as array of tag names.
   * @returns {string[]}
   */
  toArray() {
    return this.path.map((n) => n.tag);
  }
  /**
   * Reset the path to empty.
   */
  reset() {
    this._pathStringCache = null;
    this.path = [];
    this.siblingStacks = [];
    this._keptAttrs = [];
  }
  /**
   * Match current path against an Expression.
   * @param {Expression} expression
   * @returns {boolean}
   */
  matches(expression) {
    const segments = expression.segments;
    if (segments.length === 0) {
      return false;
    }
    if (expression.hasDeepWildcard()) {
      return this._matchWithDeepWildcard(segments);
    }
    return this._matchSimple(segments);
  }
  /**
   * @private
   */
  _matchSimple(segments) {
    if (this.path.length !== segments.length) {
      return false;
    }
    for (let i = 0; i < segments.length; i++) {
      if (!this._matchSegment(segments[i], this.path[i], i === this.path.length - 1)) {
        return false;
      }
    }
    return true;
  }
  /**
   * @private
   */
  _matchWithDeepWildcard(segments) {
    let pathIdx = this.path.length - 1;
    let segIdx = segments.length - 1;
    while (segIdx >= 0 && pathIdx >= 0) {
      const segment = segments[segIdx];
      if (segment.type === "deep-wildcard") {
        segIdx--;
        if (segIdx < 0) {
          return true;
        }
        const nextSeg = segments[segIdx];
        let found = false;
        for (let i = pathIdx; i >= 0; i--) {
          if (this._matchSegment(nextSeg, this.path[i], i === this.path.length - 1)) {
            pathIdx = i - 1;
            segIdx--;
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      } else {
        if (!this._matchSegment(segment, this.path[pathIdx], pathIdx === this.path.length - 1)) {
          return false;
        }
        pathIdx--;
        segIdx--;
      }
    }
    return segIdx < 0;
  }
  /**
   * @private
   */
  _matchSegment(segment, node, isCurrentNode) {
    if (segment.tag !== "*" && segment.tag !== node.tag) {
      return false;
    }
    if (segment.namespace !== void 0) {
      if (segment.namespace !== "*" && segment.namespace !== node.namespace) {
        return false;
      }
    }
    if (segment.attrName !== void 0) {
      if (!isCurrentNode) {
        return false;
      }
      if (!node.values || !(segment.attrName in node.values)) {
        return false;
      }
      if (segment.attrValue !== void 0) {
        if (String(node.values[segment.attrName]) !== String(segment.attrValue)) {
          return false;
        }
      }
    }
    if (segment.position !== void 0) {
      if (!isCurrentNode) {
        return false;
      }
      const counter = node.counter ?? 0;
      if (segment.position === "first" && counter !== 0) {
        return false;
      } else if (segment.position === "odd" && counter % 2 !== 1) {
        return false;
      } else if (segment.position === "even" && counter % 2 !== 0) {
        return false;
      } else if (segment.position === "nth" && counter !== segment.positionValue) {
        return false;
      }
    }
    return true;
  }
  /**
   * Match any expression in the given set against the current path.
   * @param {ExpressionSet} exprSet
   * @returns {boolean}
   */
  matchesAny(exprSet) {
    return exprSet.matchesAny(this);
  }
  /**
   * Create a snapshot of current state.
   * @returns {Object}
   */
  snapshot() {
    return {
      path: this.path.map((node) => ({ ...node })),
      siblingStacks: this.siblingStacks.map((level) => level ? { counts: new Map(level.counts), total: level.total } : level),
      keptAttrs: this._keptAttrs.map((entry) => ({ ...entry }))
    };
  }
  /**
   * Restore state from snapshot.
   * @param {Object} snapshot
   */
  restore(snapshot) {
    this._pathStringCache = null;
    this.path = snapshot.path.map((node) => ({ ...node }));
    this.siblingStacks = snapshot.siblingStacks.map((level) => level ? { counts: new Map(level.counts), total: level.total } : level);
    this._keptAttrs = (snapshot.keptAttrs || []).map((entry) => ({ ...entry }));
  }
  /**
   * Return the read-only {@link MatcherView} for this matcher.
   *
   * The same instance is returned on every call — no allocation occurs.
   * It always reflects the current parser state and is safe to pass to
   * user callbacks without risk of accidental mutation.
   *
   * @returns {MatcherView}
   *
   * @example
   * const view = matcher.readOnly();
   * // pass view to callbacks — it stays in sync automatically
   * view.matches(expr);       // ✓
   * view.getCurrentTag();     // ✓
   * // view.push(...)         // ✗ method does not exist — caught by TypeScript
   */
  readOnly() {
    return this._view;
  }
};

// verify/node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
function extractRawAttributes(prefixedAttrs, options) {
  if (!prefixedAttrs) return {};
  const attrs = options.attributesGroupName ? prefixedAttrs[options.attributesGroupName] : prefixedAttrs;
  if (!attrs) return {};
  const rawAttrs = {};
  for (const key in attrs) {
    if (key.startsWith(options.attributeNamePrefix)) {
      const rawName = key.substring(options.attributeNamePrefix.length);
      rawAttrs[rawName] = attrs[key];
    } else {
      rawAttrs[key] = attrs[key];
    }
  }
  return rawAttrs;
}
function extractNamespace(rawTagName) {
  if (!rawTagName || typeof rawTagName !== "string") return void 0;
  const colonIndex = rawTagName.indexOf(":");
  if (colonIndex !== -1 && colonIndex > 0) {
    const ns = rawTagName.substring(0, colonIndex);
    if (ns !== "xmlns") {
      return ns;
    }
  }
  return void 0;
}
var OrderedObjParser = class {
  constructor(options) {
    this.options = options;
    this.currentNode = null;
    this.tagsNodeStack = [];
    this.parseXml = parseXml;
    this.parseTextData = parseTextData;
    this.resolveNameSpace = resolveNameSpace;
    this.buildAttributesMap = buildAttributesMap;
    this.isItStopNode = isItStopNode;
    this.replaceEntitiesValue = replaceEntitiesValue;
    this.readStopNodeData = readStopNodeData;
    this.saveTextToParentTag = saveTextToParentTag;
    this.addChild = addChild;
    this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
    this.entityExpansionCount = 0;
    this.currentExpandedLength = 0;
    let namedEntities = { ...XML };
    if (this.options.entityDecoder) {
      this.entityDecoder = this.options.entityDecoder;
    } else {
      if (typeof this.options.htmlEntities === "object") namedEntities = this.options.htmlEntities;
      else if (this.options.htmlEntities === true) namedEntities = { ...COMMON_HTML, ...CURRENCY };
      this.entityDecoder = new EntityDecoder({
        namedEntities,
        numericAllowed: this.options.htmlEntities,
        limit: {
          maxTotalExpansions: this.options.processEntities.maxTotalExpansions,
          maxExpandedLength: this.options.processEntities.maxExpandedLength,
          applyLimitsTo: this.options.processEntities.appliesTo
        }
        //postCheck: resolved => resolved
      });
    }
    this.matcher = new Matcher();
    this.readonlyMatcher = this.matcher.readOnly();
    this.isCurrentNodeStopNode = false;
    this.stopNodeExpressionsSet = new ExpressionSet();
    const stopNodesOpts = this.options.stopNodes;
    if (stopNodesOpts && stopNodesOpts.length > 0) {
      for (let i = 0; i < stopNodesOpts.length; i++) {
        const stopNodeExp = stopNodesOpts[i];
        if (typeof stopNodeExp === "string") {
          this.stopNodeExpressionsSet.add(new Expression(stopNodeExp));
        } else if (stopNodeExp instanceof Expression) {
          this.stopNodeExpressionsSet.add(stopNodeExp);
        }
      }
      this.stopNodeExpressionsSet.seal();
    }
  }
};
function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
  const options = this.options;
  if (val !== void 0) {
    if (options.trimValues && !dontTrim) {
      val = val.trim();
    }
    if (val.length > 0) {
      if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);
      const jPathOrMatcher = options.jPath ? jPath.toString() : jPath;
      const newval = options.tagValueProcessor(tagName, val, jPathOrMatcher, hasAttributes, isLeafNode);
      if (newval === null || newval === void 0) {
        return val;
      } else if (typeof newval !== typeof val || newval !== val) {
        return newval;
      } else if (options.trimValues) {
        return parseValue(val, options.parseTagValue, options.numberParseOptions);
      } else {
        const trimmedVal = val.trim();
        if (trimmedVal === val) {
          return parseValue(val, options.parseTagValue, options.numberParseOptions);
        } else {
          return val;
        }
      }
    }
  }
}
function resolveNameSpace(tagname) {
  if (this.options.removeNSPrefix) {
    const tags = tagname.split(":");
    const prefix = tagname.charAt(0) === "/" ? "/" : "";
    if (tags[0] === "xmlns") {
      return "";
    }
    if (tags.length === 2) {
      tagname = prefix + tags[1];
    }
  }
  return tagname;
}
var attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
function buildAttributesMap(attrStr, jPath, tagName, force = false) {
  const options = this.options;
  if (force === true || options.ignoreAttributes !== true && typeof attrStr === "string") {
    const matches = getAllMatches(attrStr, attrsRegx);
    const len = matches.length;
    const attrs = {};
    const processedVals = new Array(len);
    let hasRawAttrs = false;
    const rawAttrsForMatcher = {};
    for (let i = 0; i < len; i++) {
      const attrName = this.resolveNameSpace(matches[i][1]);
      const oldVal = matches[i][4];
      if (attrName.length && oldVal !== void 0) {
        let val = oldVal;
        if (options.trimValues) val = val.trim();
        val = this.replaceEntitiesValue(val, tagName, this.readonlyMatcher);
        processedVals[i] = val;
        rawAttrsForMatcher[attrName] = val;
        hasRawAttrs = true;
      }
    }
    if (hasRawAttrs && typeof jPath === "object" && jPath.updateCurrent) {
      jPath.updateCurrent(rawAttrsForMatcher);
    }
    const jPathStr = options.jPath ? jPath.toString() : this.readonlyMatcher;
    let hasAttrs = false;
    for (let i = 0; i < len; i++) {
      const attrName = this.resolveNameSpace(matches[i][1]);
      if (this.ignoreAttributesFn(attrName, jPathStr)) continue;
      let aName = options.attributeNamePrefix + attrName;
      if (attrName.length) {
        if (options.transformAttributeName) {
          aName = options.transformAttributeName(aName);
        }
        aName = sanitizeName(aName, options);
        if (matches[i][4] !== void 0) {
          const oldVal = processedVals[i];
          const newVal = options.attributeValueProcessor(attrName, oldVal, jPathStr);
          if (newVal === null || newVal === void 0) {
            attrs[aName] = oldVal;
          } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
            attrs[aName] = newVal;
          } else {
            attrs[aName] = parseValue(oldVal, options.parseAttributeValue, options.numberParseOptions);
          }
          hasAttrs = true;
        } else if (options.allowBooleanAttributes) {
          attrs[aName] = true;
          hasAttrs = true;
        }
      }
    }
    if (!hasAttrs) return;
    if (options.attributesGroupName) {
      const attrCollection = {};
      attrCollection[options.attributesGroupName] = attrs;
      return attrCollection;
    }
    return attrs;
  }
}
var parseXml = function(xmlData) {
  xmlData = xmlData.replace(/\r\n?/g, "\n");
  const xmlObj = new XmlNode("!xml");
  let currentNode = xmlObj;
  let textData = "";
  this.matcher.reset();
  this.entityDecoder.reset();
  this.entityExpansionCount = 0;
  this.currentExpandedLength = 0;
  const options = this.options;
  const docTypeReader = new DocTypeReader(options.processEntities);
  const xmlLen = xmlData.length;
  for (let i = 0; i < xmlLen; i++) {
    const ch = xmlData[i];
    if (ch === "<") {
      const c1 = xmlData.charCodeAt(i + 1);
      if (c1 === 47) {
        const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
        let tagName = xmlData.substring(i + 2, closeIndex).trim();
        if (options.removeNSPrefix) {
          const colonIndex = tagName.indexOf(":");
          if (colonIndex !== -1) {
            tagName = tagName.substr(colonIndex + 1);
          }
        }
        tagName = transformTagName(options.transformTagName, tagName, "", options).tagName;
        if (currentNode) {
          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        }
        const lastTagName = this.matcher.getCurrentTag();
        if (tagName && options.unpairedTagsSet.has(tagName)) {
          throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
        }
        if (lastTagName && options.unpairedTagsSet.has(lastTagName)) {
          this.matcher.pop();
          this.tagsNodeStack.pop();
        }
        this.matcher.pop();
        this.isCurrentNodeStopNode = false;
        currentNode = this.tagsNodeStack.pop();
        textData = "";
        i = closeIndex;
      } else if (c1 === 63) {
        let tagData = readTagExp(xmlData, i, false, "?>");
        if (!tagData) throw new Error("Pi Tag is not closed.");
        textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        const attsMap = this.buildAttributesMap(tagData.tagExp, this.matcher, tagData.tagName, true);
        if (attsMap) {
          const ver = attsMap[this.options.attributeNamePrefix + "version"];
          this.entityDecoder.setXmlVersion(Number(ver) || 1);
        }
        if (options.ignoreDeclaration && tagData.tagName === "?xml" || options.ignorePiTags) {
        } else {
          const childNode = new XmlNode(tagData.tagName);
          childNode.add(options.textNodeName, "");
          if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent && options.ignoreAttributes !== true) {
            childNode[":@"] = attsMap;
          }
          this.addChild(currentNode, childNode, this.readonlyMatcher, i);
        }
        i = tagData.closeIndex + 1;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 45 && xmlData.charCodeAt(i + 3) === 45) {
        const endIndex = findClosingIndex(xmlData, "-->", i + 4, "Comment is not closed.");
        if (options.commentPropName) {
          const comment = xmlData.substring(i + 4, endIndex - 2);
          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
          currentNode.add(options.commentPropName, [{ [options.textNodeName]: comment }]);
        }
        i = endIndex;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 68) {
        const result = docTypeReader.readDocType(xmlData, i);
        this.entityDecoder.addInputEntities(result.entities);
        i = result.i;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 91) {
        const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
        const tagExp = xmlData.substring(i + 9, closeIndex);
        textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        let val = this.parseTextData(tagExp, currentNode.tagname, this.readonlyMatcher, true, false, true, true);
        if (val == void 0) val = "";
        if (options.cdataPropName) {
          currentNode.add(options.cdataPropName, [{ [options.textNodeName]: tagExp }]);
        } else {
          currentNode.add(options.textNodeName, val);
        }
        i = closeIndex + 2;
      } else {
        let result = readTagExp(xmlData, i, options.removeNSPrefix);
        if (!result) {
          const context = xmlData.substring(Math.max(0, i - 50), Math.min(xmlLen, i + 50));
          throw new Error(`readTagExp returned undefined at position ${i}. Context: "${context}"`);
        }
        let tagName = result.tagName;
        const rawTagName = result.rawTagName;
        let tagExp = result.tagExp;
        let attrExpPresent = result.attrExpPresent;
        let closeIndex = result.closeIndex;
        ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));
        if (options.strictReservedNames && (tagName === options.commentPropName || tagName === options.cdataPropName || tagName === options.textNodeName || tagName === options.attributesGroupName)) {
          throw new Error(`Invalid tag name: ${tagName}`);
        }
        if (currentNode && textData) {
          if (currentNode.tagname !== "!xml") {
            textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher, false);
          }
        }
        const lastTag = currentNode;
        if (lastTag && options.unpairedTagsSet.has(lastTag.tagname)) {
          currentNode = this.tagsNodeStack.pop();
          this.matcher.pop();
        }
        let isSelfClosing = false;
        if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
          isSelfClosing = true;
          if (tagName[tagName.length - 1] === "/") {
            tagName = tagName.substr(0, tagName.length - 1);
            tagExp = tagName;
          } else {
            tagExp = tagExp.substr(0, tagExp.length - 1);
          }
          attrExpPresent = tagName !== tagExp;
        }
        let prefixedAttrs = null;
        let rawAttrs = {};
        let namespace = void 0;
        namespace = extractNamespace(rawTagName);
        if (tagName !== xmlObj.tagname) {
          this.matcher.push(tagName, {}, namespace);
        }
        if (tagName !== tagExp && attrExpPresent) {
          prefixedAttrs = this.buildAttributesMap(tagExp, this.matcher, tagName);
          if (prefixedAttrs) {
            rawAttrs = extractRawAttributes(prefixedAttrs, options);
          }
        }
        if (tagName !== xmlObj.tagname) {
          this.isCurrentNodeStopNode = this.isItStopNode();
        }
        const startIndex = i;
        if (this.isCurrentNodeStopNode) {
          let tagContent = "";
          if (isSelfClosing) {
            i = result.closeIndex;
          } else if (options.unpairedTagsSet.has(tagName)) {
            i = result.closeIndex;
          } else {
            const result2 = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
            if (!result2) throw new Error(`Unexpected end of ${rawTagName}`);
            i = result2.i;
            tagContent = result2.tagContent;
          }
          const childNode = new XmlNode(tagName);
          if (prefixedAttrs) {
            childNode[":@"] = prefixedAttrs;
          }
          childNode.add(options.textNodeName, tagContent);
          this.matcher.pop();
          this.isCurrentNodeStopNode = false;
          this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
        } else {
          if (isSelfClosing) {
            ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));
            const childNode = new XmlNode(tagName);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            this.matcher.pop();
            this.isCurrentNodeStopNode = false;
          } else if (options.unpairedTagsSet.has(tagName)) {
            const childNode = new XmlNode(tagName);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            this.matcher.pop();
            this.isCurrentNodeStopNode = false;
            i = result.closeIndex;
            continue;
          } else {
            const childNode = new XmlNode(tagName);
            if (this.tagsNodeStack.length > options.maxNestedTags) {
              throw new Error("Maximum nested tags exceeded");
            }
            this.tagsNodeStack.push(currentNode);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            currentNode = childNode;
          }
          textData = "";
          i = closeIndex;
        }
      }
    } else {
      textData += xmlData[i];
    }
  }
  return xmlObj.child;
};
function addChild(currentNode, childNode, matcher, startIndex) {
  if (!this.options.captureMetaData) startIndex = void 0;
  const jPathOrMatcher = this.options.jPath ? matcher.toString() : matcher;
  const result = this.options.updateTag(childNode.tagname, jPathOrMatcher, childNode[":@"]);
  if (result === false) {
  } else if (typeof result === "string") {
    childNode.tagname = result;
    currentNode.addChild(childNode, startIndex);
  } else {
    currentNode.addChild(childNode, startIndex);
  }
}
function replaceEntitiesValue(val, tagName, jPath) {
  const entityConfig = this.options.processEntities;
  if (!entityConfig || !entityConfig.enabled) {
    return val;
  }
  if (entityConfig.allowedTags) {
    const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
    const allowed = Array.isArray(entityConfig.allowedTags) ? entityConfig.allowedTags.includes(tagName) : entityConfig.allowedTags(tagName, jPathOrMatcher);
    if (!allowed) {
      return val;
    }
  }
  if (entityConfig.tagFilter) {
    const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
    if (!entityConfig.tagFilter(tagName, jPathOrMatcher)) {
      return val;
    }
  }
  return this.entityDecoder.decode(val);
}
function saveTextToParentTag(textData, parentNode, matcher, isLeafNode) {
  if (textData) {
    if (isLeafNode === void 0) isLeafNode = parentNode.child.length === 0;
    textData = this.parseTextData(
      textData,
      parentNode.tagname,
      matcher,
      false,
      parentNode[":@"] ? Object.keys(parentNode[":@"]).length !== 0 : false,
      isLeafNode
    );
    if (textData !== void 0 && textData !== "")
      parentNode.add(this.options.textNodeName, textData);
    textData = "";
  }
  return textData;
}
function isItStopNode() {
  if (this.stopNodeExpressionsSet.size === 0) return false;
  return this.matcher.matchesAny(this.stopNodeExpressionsSet);
}
function tagExpWithClosingIndex(xmlData, i, closingChar = ">") {
  let attrBoundary = 0;
  const chars = [];
  const len = xmlData.length;
  const closeCode0 = closingChar.charCodeAt(0);
  const closeCode1 = closingChar.length > 1 ? closingChar.charCodeAt(1) : -1;
  for (let index2 = i; index2 < len; index2++) {
    const code = xmlData.charCodeAt(index2);
    if (attrBoundary) {
      if (code === attrBoundary) attrBoundary = 0;
    } else if (code === 34 || code === 39) {
      attrBoundary = code;
    } else if (code === closeCode0) {
      if (closeCode1 !== -1) {
        if (xmlData.charCodeAt(index2 + 1) === closeCode1) {
          return { data: String.fromCharCode(...chars), index: index2 };
        }
      } else {
        return { data: String.fromCharCode(...chars), index: index2 };
      }
    } else if (code === 9) {
      chars.push(32);
      continue;
    }
    chars.push(code);
  }
}
function findClosingIndex(xmlData, str, i, errMsg) {
  const closingIndex = xmlData.indexOf(str, i);
  if (closingIndex === -1) {
    throw new Error(errMsg);
  } else {
    return closingIndex + str.length - 1;
  }
}
function findClosingChar(xmlData, char, i, errMsg) {
  const closingIndex = xmlData.indexOf(char, i);
  if (closingIndex === -1) throw new Error(errMsg);
  return closingIndex;
}
function readTagExp(xmlData, i, removeNSPrefix, closingChar = ">") {
  const result = tagExpWithClosingIndex(xmlData, i + 1, closingChar);
  if (!result) return;
  let tagExp = result.data;
  const closeIndex = result.index;
  const separatorIndex = tagExp.search(/\s/);
  let tagName = tagExp;
  let attrExpPresent = true;
  if (separatorIndex !== -1) {
    tagName = tagExp.substring(0, separatorIndex);
    tagExp = tagExp.substring(separatorIndex + 1).trimStart();
  }
  const rawTagName = tagName;
  if (removeNSPrefix) {
    const colonIndex = tagName.indexOf(":");
    if (colonIndex !== -1) {
      tagName = tagName.substr(colonIndex + 1);
      attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
    }
  }
  return {
    tagName,
    tagExp,
    closeIndex,
    attrExpPresent,
    rawTagName
  };
}
function readStopNodeData(xmlData, tagName, i) {
  const startIndex = i;
  let openTagCount = 1;
  const xmllen = xmlData.length;
  for (; i < xmllen; i++) {
    if (xmlData[i] === "<") {
      const c1 = xmlData.charCodeAt(i + 1);
      if (c1 === 47) {
        const closeIndex = findClosingChar(xmlData, ">", i, `${tagName} is not closed`);
        let closeTagName = xmlData.substring(i + 2, closeIndex).trim();
        if (closeTagName === tagName) {
          openTagCount--;
          if (openTagCount === 0) {
            return {
              tagContent: xmlData.substring(startIndex, i),
              i: closeIndex
            };
          }
        }
        i = closeIndex;
      } else if (c1 === 63) {
        const closeIndex = findClosingIndex(xmlData, "?>", i + 1, "StopNode is not closed.");
        i = closeIndex;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 45 && xmlData.charCodeAt(i + 3) === 45) {
        const closeIndex = findClosingIndex(xmlData, "-->", i + 3, "StopNode is not closed.");
        i = closeIndex;
      } else if (c1 === 33 && xmlData.charCodeAt(i + 2) === 91) {
        const closeIndex = findClosingIndex(xmlData, "]]>", i, "StopNode is not closed.") - 2;
        i = closeIndex;
      } else {
        const tagData = readTagExp(xmlData, i, ">");
        if (tagData) {
          const openTagName = tagData && tagData.tagName;
          if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== "/") {
            openTagCount++;
          }
          i = tagData.closeIndex;
        }
      }
    }
  }
}
function parseValue(val, shouldParse, options) {
  if (shouldParse && typeof val === "string") {
    const newval = val.trim();
    if (newval === "true") return true;
    else if (newval === "false") return false;
    else return toNumber(val, options);
  } else {
    if (isExist(val)) {
      return val;
    } else {
      return "";
    }
  }
}
function transformTagName(fn, tagName, tagExp, options) {
  if (fn) {
    const newTagName = fn(tagName);
    if (tagExp === tagName) {
      tagExp = newTagName;
    }
    tagName = newTagName;
  }
  tagName = sanitizeName(tagName, options);
  return { tagName, tagExp };
}
function sanitizeName(name, options) {
  if (criticalProperties.includes(name)) {
    throw new Error(`[SECURITY] Invalid name: "${name}" is a reserved JavaScript keyword that could cause prototype pollution`);
  } else if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
    return options.onDangerousProperty(name);
  }
  return name;
}

// verify/node_modules/fast-xml-parser/src/xmlparser/node2json.js
var METADATA_SYMBOL2 = XmlNode.getMetaDataSymbol();
function stripAttributePrefix(attrs, prefix) {
  if (!attrs || typeof attrs !== "object") return {};
  if (!prefix) return attrs;
  const rawAttrs = {};
  for (const key in attrs) {
    if (key.startsWith(prefix)) {
      const rawName = key.substring(prefix.length);
      rawAttrs[rawName] = attrs[key];
    } else {
      rawAttrs[key] = attrs[key];
    }
  }
  return rawAttrs;
}
function prettify(node, options, matcher, readonlyMatcher) {
  return compress(node, options, matcher, readonlyMatcher);
}
function compress(arr, options, matcher, readonlyMatcher) {
  let text4;
  const compressedObj = {};
  for (let i = 0; i < arr.length; i++) {
    const tagObj = arr[i];
    const property = propName(tagObj);
    if (property !== void 0 && property !== options.textNodeName) {
      const rawAttrs = stripAttributePrefix(
        tagObj[":@"] || {},
        options.attributeNamePrefix
      );
      matcher.push(property, rawAttrs);
    }
    if (property === options.textNodeName) {
      if (text4 === void 0) text4 = tagObj[property];
      else text4 += "" + tagObj[property];
    } else if (property === void 0) {
      continue;
    } else if (tagObj[property]) {
      let val = compress(tagObj[property], options, matcher, readonlyMatcher);
      const isLeaf = isLeafTag(val, options);
      if (tagObj[":@"]) {
        assignAttributes(val, tagObj[":@"], readonlyMatcher, options);
      } else if (Object.keys(val).length === 1 && val[options.textNodeName] !== void 0 && !options.alwaysCreateTextNode) {
        val = val[options.textNodeName];
      } else if (Object.keys(val).length === 0) {
        if (options.alwaysCreateTextNode) val[options.textNodeName] = "";
        else val = "";
      }
      if (tagObj[METADATA_SYMBOL2] !== void 0 && typeof val === "object" && val !== null) {
        val[METADATA_SYMBOL2] = tagObj[METADATA_SYMBOL2];
      }
      if (compressedObj[property] !== void 0 && Object.prototype.hasOwnProperty.call(compressedObj, property)) {
        if (!Array.isArray(compressedObj[property])) {
          compressedObj[property] = [compressedObj[property]];
        }
        compressedObj[property].push(val);
      } else {
        const jPathOrMatcher = options.jPath ? readonlyMatcher.toString() : readonlyMatcher;
        if (options.isArray(property, jPathOrMatcher, isLeaf)) {
          compressedObj[property] = [val];
        } else {
          compressedObj[property] = val;
        }
      }
      if (property !== void 0 && property !== options.textNodeName) {
        matcher.pop();
      }
    }
  }
  if (typeof text4 === "string") {
    if (text4.length > 0) compressedObj[options.textNodeName] = text4;
  } else if (text4 !== void 0) compressedObj[options.textNodeName] = text4;
  return compressedObj;
}
function propName(obj) {
  const keys2 = Object.keys(obj);
  for (let i = 0; i < keys2.length; i++) {
    const key = keys2[i];
    if (key !== ":@") return key;
  }
}
function assignAttributes(obj, attrMap, readonlyMatcher, options) {
  if (attrMap) {
    const keys2 = Object.keys(attrMap);
    const len = keys2.length;
    for (let i = 0; i < len; i++) {
      const atrrName = keys2[i];
      const rawAttrName = atrrName.startsWith(options.attributeNamePrefix) ? atrrName.substring(options.attributeNamePrefix.length) : atrrName;
      const jPathOrMatcher = options.jPath ? readonlyMatcher.toString() + "." + rawAttrName : readonlyMatcher;
      if (options.isArray(atrrName, jPathOrMatcher, true, true)) {
        obj[atrrName] = [attrMap[atrrName]];
      } else {
        obj[atrrName] = attrMap[atrrName];
      }
    }
  }
}
function isLeafTag(obj, options) {
  const { textNodeName } = options;
  const propCount = Object.keys(obj).length;
  if (propCount === 0) {
    return true;
  }
  if (propCount === 1 && (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)) {
    return true;
  }
  return false;
}

// verify/node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
var XMLParser = class {
  constructor(options) {
    this.externalEntities = {};
    this.options = buildOptions(options);
  }
  /**
   * Parse XML dats to JS object 
   * @param {string|Uint8Array} xmlData 
   * @param {boolean|Object} validationOption 
   */
  parse(xmlData, validationOption) {
    if (typeof xmlData !== "string" && xmlData.toString) {
      xmlData = xmlData.toString();
    } else if (typeof xmlData !== "string") {
      throw new Error("XML data is accepted in String or Bytes[] form.");
    }
    if (validationOption) {
      if (validationOption === true) validationOption = {};
      const result = validate(xmlData, validationOption);
      if (result !== true) {
        throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`);
      }
    }
    const orderedObjParser = new OrderedObjParser(this.options);
    orderedObjParser.entityDecoder.setExternalEntities(this.externalEntities);
    const orderedResult = orderedObjParser.parseXml(xmlData);
    if (this.options.preserveOrder || orderedResult === void 0) return orderedResult;
    else return prettify(orderedResult, this.options, orderedObjParser.matcher, orderedObjParser.readonlyMatcher);
  }
  /**
   * Add Entity which is not by default supported by this library
   * @param {string} key 
   * @param {string} value 
   */
  addEntity(key, value) {
    if (value.indexOf("&") !== -1) {
      throw new Error("Entity value can't have '&'");
    } else if (key.indexOf("&") !== -1 || key.indexOf(";") !== -1) {
      throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
    } else if (value === "&") {
      throw new Error("An entity with value '&' is not permitted");
    } else {
      this.externalEntities[key] = value;
    }
  }
  /**
   * Returns a Symbol that can be used to access the metadata
   * property on a node.
   * 
   * If Symbol is not available in the environment, an ordinary property is used
   * and the name of the property is here returned.
   * 
   * The XMLMetaData property is only present when `captureMetaData`
   * is true in the options.
   */
  static getMetaDataSymbol() {
    return XmlNode.getMetaDataSymbol();
  }
};

// candidate-probe-v4-src/lib/oecd.ts
var OECD_PUBLIC_BASE = "https://globalrecalls.oecd.org/";
var OECD_API_BASE = `${OECD_PUBLIC_BASE}ws`;
var OECD_SEARCH_ENDPOINT = `${OECD_API_BASE}/search.xqy`;
var OECD_DETAIL_ENDPOINT = `${OECD_API_BASE}/getrecall.xqy`;
var OECD_DOCUMENT_ENDPOINT = `${OECD_API_BASE}/getdocument.xqy`;
var OECD_EXPORT_ENDPOINT = `${OECD_API_BASE}/export.xqy`;
var OECD_RSS_ENDPOINT = `${OECD_API_BASE}/rss.xqy`;
var OECD_URI_PREFIX = "http://PoliciesApplications.oecd.org/GlobalRecalls/Recall/";
var RSS_WINDOW_MS = 7 * 24 * 60 * 6e4;
var INVALID_SENTINEL_DATE = "1900-01-01";
var OECD_RECENT_RECONCILIATION_DAYS = 30;
var RECENT_CANDIDATE_LIMIT = 250;
var OecdRequestError = class extends Error {
  constructor(message, kind, status = null) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.name = "OecdRequestError";
  }
};
var xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false
});
var defaultSleep2 = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
var retryableStatus2 = (status) => status === 408 || status === 425 || status === 429 || status >= 500;
var stringValue2 = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && !Array.isArray(value)) return stringValue2(value["#text"]);
  return "";
};
var arrayValue = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
var recordValue = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
var uniqueStrings3 = (values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "en"));
var minDate4 = (current, candidate) => !candidate ? current : !current || candidate < current ? candidate : current;
var maxDate4 = (current, candidate) => !candidate ? current : !current || candidate > current ? candidate : current;
var parseOecdPortalTime = (value) => {
  const normalized = /^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:$/u.test(value.trim()) ? `${value.trim()}00 GMT` : value;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? milliseconds : null;
};
var retryDelay2 = (response, attempt) => {
  const header = response?.headers.get("Retry-After")?.trim() ?? "";
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1e3, 3e4);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), 3e4);
  return 500 * (attempt + 1);
};
async function requestText(url, accept, client = {}) {
  const fetchImpl = client.fetchImpl ?? fetch;
  const sleep = client.sleep ?? defaultSleep2;
  const retries = Math.max(0, Math.min(4, client.retries ?? 2));
  const timeoutMs = Math.max(1e3, client.timeoutMs ?? 9e4);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response = null;
    try {
      response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "Accept": accept }
      });
      if (!response.ok) {
        const error = new OecdRequestError(`OECD respondi\xF3 con estado ${response.status}`, "http", response.status);
        if (!retryableStatus2(response.status) || attempt === retries) throw error;
        lastError = error;
        await sleep(retryDelay2(response, attempt));
        continue;
      }
      return await response.text();
    } catch (error) {
      if (error instanceof OecdRequestError && !retryableStatus2(error.status ?? 0)) throw error;
      lastError = error;
      if (attempt === retries) {
        const timeout = error instanceof Error && /abort|timeout/i.test(`${error.name} ${error.message}`);
        throw error instanceof OecdRequestError ? error : new OecdRequestError(
          timeout ? "OECD agot\xF3 el tiempo de respuesta" : "No se pudo conectar con OECD",
          timeout ? "timeout" : "network"
        );
      }
      await sleep(retryDelay2(response, attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new OecdRequestError("OECD no respondi\xF3", "network");
}
async function requestJson3(url, client = {}) {
  const text4 = await requestText(url, "application/json", client);
  try {
    return JSON.parse(text4);
  } catch (error) {
    throw new OecdRequestError(`OECD devolvi\xF3 JSON inv\xE1lido: ${error instanceof Error ? error.message : "respuesta ilegible"}`, "invalid-response");
  }
}
var decodeEntities2 = (value) => value.replaceAll("&nbsp;", " ").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)));
var normalizeOecdText = (value) => decodeEntities2(value).replace(/<br\s*\/?\s*>/giu, " \xB7 ").replace(/<\/p\s*>/giu, " ").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
function parseOecdUri(value) {
  if (!value.startsWith(OECD_URI_PREFIX)) return null;
  const tail = value.slice(OECD_URI_PREFIX.length);
  const [languageId, countryId, ...idParts] = tail.split("/");
  const encodedId = idParts.join("/");
  let id = encodedId;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
  }
  if (!languageId || !countryId || !id || idParts.some((part) => !part)) return null;
  return { languageId: languageId.toUpperCase(), countryId: countryId.toUpperCase(), id };
}
var oecdUri = (languageId, countryId, id) => `${OECD_URI_PREFIX}${languageId.toUpperCase()}/${countryId.toUpperCase()}/${encodeURIComponent(id.trim())}`;
var oecdReference = (uri) => {
  const parsed = parseOecdUri(uri);
  return parsed ? `${parsed.languageId}/${parsed.countryId}/${parsed.id}` : "";
};
var oecdOfficialUrl = (uri) => `${OECD_PUBLIC_BASE}#/recalls/${encodeURIComponent(uri)}`;
var oecdDocumentUrl = (uri) => `${OECD_DOCUMENT_ENDPOINT}?${new URLSearchParams({ uri }).toString()}`;
function parseOecdExport(xml) {
  let parsed;
  try {
    parsed = recordValue(xmlParser.parse(xml));
  } catch (error) {
    throw new OecdRequestError(`OECD devolvi\xF3 XML de exportaci\xF3n inv\xE1lido: ${error instanceof Error ? error.message : "respuesta ilegible"}`, "invalid-response");
  }
  const root = recordValue(parsed.recalls);
  return arrayValue(root.recall).map(recordValue).map((raw) => {
    const id = stringValue2(raw.id);
    const languageId = stringValue2(raw["@lang"]).toUpperCase();
    const country2 = recordValue(raw.country_id);
    const countryId = stringValue2(country2["@labelkey"]).toUpperCase() || stringValue2(raw.from_area_id).toUpperCase();
    const countryName = stringValue2(raw.country_id);
    return {
      uri: oecdUri(languageId, countryId, id),
      id,
      languageId,
      countryId,
      countryName,
      publishedDate: stringValue2(raw.date),
      portalCreatedAt: stringValue2(raw.created),
      externalUrl: stringValue2(raw.URL),
      productName: stringValue2(raw.product_name),
      raw
    };
  });
}
function parseOecdSearch(payload) {
  const root = recordValue(payload);
  const start = Number(root.start);
  const pageLength = Number(root["page-length"]);
  const total = Number(root.total);
  const results = arrayValue(root.results).map(recordValue).map((raw) => {
    const uri = stringValue2(raw.uri);
    const identity2 = parseOecdUri(uri);
    return {
      uri,
      id: stringValue2(raw.id) || identity2?.id || "",
      languageId: (stringValue2(raw.languageId) || identity2?.languageId || "").toUpperCase(),
      countryId: (stringValue2(raw.countryId) || identity2?.countryId || "").toUpperCase(),
      countryName: stringValue2(raw.countryName),
      publishedDate: stringValue2(raw.date),
      portalCreatedAt: "",
      externalUrl: stringValue2(raw.extUrl),
      productName: stringValue2(raw["product.name"]),
      raw
    };
  });
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(pageLength) || pageLength < 0 || pageLength > 20 || !Number.isInteger(total) || total < 0 || results.length > 20) {
    throw new OecdRequestError("OECD devolvi\xF3 metadatos de paginaci\xF3n incoherentes", "pagination");
  }
  return { start, pageLength, total, results };
}
async function fetchOecdSearchPage(offset = 0, query = "", client = {}) {
  const boundedOffset = Math.max(0, Math.trunc(offset));
  const params = new URLSearchParams({
    q: query,
    start: String(boundedOffset),
    end: String(boundedOffset + 20),
    lang: "en",
    uiLang: "en",
    sort: "date",
    order: "desc"
  });
  return parseOecdSearch(await requestJson3(`${OECD_SEARCH_ENDPOINT}?${params.toString()}`, client));
}
async function fetchOecdSearchIndex(query = "", client = {}, maximumPages = 1e4) {
  const records = [];
  const signatures = /* @__PURE__ */ new Set();
  const uris = /* @__PURE__ */ new Set();
  let expectedTotal = null;
  for (let pageNumber = 0; pageNumber < maximumPages; pageNumber += 1) {
    const offset = pageNumber * 20;
    const expectedStart = offset + 1;
    const page = await fetchOecdSearchPage(offset, query, client);
    const signature = page.results.map((record7) => record7.uri).join("\n");
    expectedTotal ??= page.total;
    if (page.start !== expectedStart || page.total !== expectedTotal || signature && signatures.has(signature)) {
      throw new OecdRequestError("OECD repiti\xF3 o desorden\xF3 una p\xE1gina de b\xFAsqueda", "pagination");
    }
    if (signature) signatures.add(signature);
    for (const record7 of page.results) {
      if (uris.has(record7.uri)) throw new OecdRequestError("OECD repiti\xF3 una identidad en la b\xFAsqueda", "pagination");
      uris.add(record7.uri);
    }
    records.push(...page.results);
    if (records.length === expectedTotal) return { records, pagesScanned: pageNumber + 1, total: expectedTotal };
    if (!page.results.length || records.length > expectedTotal) {
      throw new OecdRequestError("OECD trunc\xF3 o excedi\xF3 el total de b\xFAsqueda", "pagination");
    }
  }
  throw new OecdRequestError("OECD super\xF3 el l\xEDmite de p\xE1ginas de b\xFAsqueda", "pagination");
}
function parseOecdRss(xml) {
  let parsed;
  try {
    parsed = recordValue(xmlParser.parse(xml));
  } catch (error) {
    throw new OecdRequestError(`OECD devolvi\xF3 RSS inv\xE1lido: ${error instanceof Error ? error.message : "respuesta ilegible"}`, "invalid-response");
  }
  const channel = recordValue(recordValue(parsed.rss).channel);
  return arrayValue(channel.item).map(recordValue).map((raw) => ({
    uri: stringValue2(raw.guid),
    title: stringValue2(raw.title),
    description: stringValue2(raw.description),
    countryName: stringValue2(raw.creator),
    submittedDate: stringValue2(raw.dateSubmitted),
    portalPublishedAt: stringValue2(raw.pubDate),
    raw
  }));
}
var parseProductCodes = (value) => arrayValue(value).map(recordValue).flatMap((raw) => {
  const code = stringValue2(raw.code);
  if (!code) return [];
  return [{
    code,
    description: stringValue2(raw.desc),
    type: stringValue2(raw.type).toLowerCase(),
    taxonomyVersion: stringValue2(raw.GPC)
  }];
}).filter((entry, index2, all) => all.findIndex((candidate) => candidate.code === entry.code && candidate.type === entry.type && candidate.description === entry.description && candidate.taxonomyVersion === entry.taxonomyVersion) === index2).sort((left, right) => `${left.type}:${left.code}:${left.description}`.localeCompare(`${right.type}:${right.code}:${right.description}`, "en"));
var parseCountries = (value) => arrayValue(value).map(recordValue).flatMap((raw) => {
  const id = stringValue2(raw.id).toUpperCase();
  const name = stringValue2(raw.name);
  return id || name ? [{ id, name }] : [];
}).filter((entry, index2, all) => all.findIndex((candidate) => candidate.id === entry.id && candidate.name === entry.name) === index2).sort((left, right) => `${left.id}:${left.name}`.localeCompare(`${right.id}:${right.name}`, "en"));
var parseImages = (value) => arrayValue(value).map(recordValue).flatMap((raw) => {
  const uri = stringValue2(raw.imageUri);
  return uri ? [{ uri, alt: stringValue2(raw["alt.text"]), mediaType: stringValue2(raw["media.type"]) }] : [];
}).filter((entry, index2, all) => all.findIndex((candidate) => candidate.uri === entry.uri) === index2).sort((left, right) => left.uri.localeCompare(right.uri, "en"));
var parsePublishedCodes = (value) => uniqueStrings3(arrayValue(value).flatMap((candidate) => {
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const row = candidate;
    return [stringValue2(row.code), stringValue2(row["#text"])];
  }
  return [stringValue2(candidate)];
}));
function parseOecdDetail(payload) {
  const root = recordValue(payload);
  const raw = recordValue(root.recall);
  const uri = stringValue2(raw.uri);
  const identity2 = parseOecdUri(uri);
  const productName = stringValue2(raw["product.name"]);
  if (!identity2 || !productName) throw new OecdRequestError("OECD devolvi\xF3 un detalle sin identidad o producto", "data-missing");
  return {
    uri: oecdUri(identity2.languageId, identity2.countryId, identity2.id),
    id: stringValue2(raw.id) || identity2.id,
    languageId: (stringValue2(raw.languageId) || identity2.languageId).toUpperCase(),
    languageName: stringValue2(raw.language),
    countryId: (stringValue2(raw.countryId) || identity2.countryId).toUpperCase(),
    countryName: stringValue2(raw.countryName),
    publishedDate: stringValue2(raw.date),
    externalUrl: stringValue2(raw.extUrl),
    productName,
    productDescription: stringValue2(raw["product.desc"]),
    productType: stringValue2(raw["product.type"]),
    productModelAndVolume: stringValue2(raw["product.modelAndVolume"]),
    productCodes: parseProductCodes(raw["product.code"]),
    manufacturerCountries: parseCountries(raw["manufacturer.country"]),
    manufacturerName: stringValue2(raw["manufacturer.name"]),
    manufacturerUrl: stringValue2(raw["manufacturer.url"]),
    distributorName: stringValue2(raw["distributor.name"]),
    distributorUrl: stringValue2(raw["distributor.website"]),
    gtin: parsePublishedCodes(raw.gtin),
    hts: parsePublishedCodes(raw.hts),
    hazard: stringValue2(raw.hazard),
    action: stringValue2(raw.action),
    injuries: stringValue2(raw.injuries),
    riskLevel: stringValue2(raw.riskLevel),
    units: stringValue2(raw.units),
    images: parseImages(raw.images),
    raw
  };
}
async function fetchOecdDetail(uri, client = {}) {
  const query = new URLSearchParams({ uri, uiLang: "en" });
  return parseOecdDetail(await requestJson3(`${OECD_DETAIL_ENDPOINT}?${query.toString()}`, client));
}
var validExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};
function classifyOecdDomain(productCodes) {
  const segment = productCodes.find((entry) => entry.type === "segment");
  const family = productCodes.find((entry) => entry.type === "family");
  if (!segment) return { normalized: "Sin clasificar", canonical: "Sin clasificar", rule: "missing-gpc-segment" };
  if (segment.code !== "50000000") return { normalized: "No alimentaria", canonical: "No alimentaci\xF3n", rule: "gpc-non-food-segment" };
  if (family?.code === "50210000" || /tobacco|cannabis|smoking/iu.test(family?.description ?? "")) {
    return { normalized: "No alimentaria", canonical: "No alimentaci\xF3n", rule: "gpc-tobacco-family" };
  }
  if (family) return { normalized: "Alimentaria", canonical: "Alimentaria", rule: "gpc-food-family" };
  return { normalized: "Sin clasificar", canonical: "Sin clasificar", rule: "ambiguous-food-beverage-tobacco-segment" };
}
var priorityFrom = (riskLevel) => /critical|serious|high|grave|sérieux/iu.test(riskLevel) ? "Alta" : "Media";
async function normalizeOecdDetail(detail3, detectedAt = (/* @__PURE__ */ new Date()).toISOString(), context = {}) {
  const reference = oecdReference(detail3.uri);
  if (!reference) throw new OecdRequestError("El detalle OECD no permite construir una identidad estable", "data-missing");
  const officialUrl2 = oecdOfficialUrl(detail3.uri);
  const id = sourceScopedId("OECD", reference);
  const seed = { source: "OECD", sourceRecordId: reference, officialUrl: officialUrl2 };
  const productName = normalizeOecdText(detail3.productName);
  if (!productName) throw new OecdRequestError(`El registro OECD ${reference} no contiene nombre de producto`, "data-missing");
  const productDescription = normalizeOecdText(detail3.productDescription);
  const hazard = normalizeOecdText(detail3.hazard);
  const action = normalizeOecdText(detail3.action);
  const model = normalizeOecdText(detail3.productModelAndVolume);
  const categoryCode = detail3.productCodes.find((entry) => entry.type === "brick") ?? detail3.productCodes.find((entry) => entry.type === "class") ?? detail3.productCodes.find((entry) => entry.type === "family") ?? detail3.productCodes.find((entry) => entry.type === "segment");
  const category = categoryCode?.description || normalizeOecdText(detail3.productType);
  const domain = classifyOecdDomain(detail3.productCodes);
  const originCountries = uniqueStrings3(detail3.manufacturerCountries.map((country2) => country2.name || country2.id));
  const publication = detail3.publishedDate === INVALID_SENTINEL_DATE ? "" : detail3.publishedDate;
  const publishedAt = /^\d{4}-\d{2}-\d{2}$/u.test(publication) ? `${publication}T00:00:00.000Z` : "";
  const portalCreatedAt = context.exportRecord?.portalCreatedAt || context.rssItem?.portalPublishedAt || "";
  const portalCreatedMs = parseOecdPortalTime(portalCreatedAt);
  const portalCreatedIso = portalCreatedMs === null ? "" : new Date(portalCreatedMs).toISOString();
  const operators = [
    ...detail3.manufacturerName ? [{
      role: "manufacturer",
      name: knownValue(detail3.manufacturerName, normalizeOecdText(detail3.manufacturerName), seed, "manufacturer.name"),
      evidence: "manufacturer.name"
    }] : [],
    ...detail3.distributorName ? [{
      role: "distributor",
      name: knownValue(detail3.distributorName, normalizeOecdText(detail3.distributorName), seed, "distributor.name"),
      evidence: "distributor.name"
    }] : []
  ].filter((operator, index2, all) => all.findIndex((candidate) => candidate.role === operator.role && candidate.name.normalized?.toLocaleLowerCase("en") === operator.name.normalized?.toLocaleLowerCase("en")) === index2);
  const identifiers = [
    ...detail3.gtin.map((value) => ({ kind: "ean", value, published: value })),
    ...detail3.hts.map((value) => ({ kind: "other", value, published: value }))
  ];
  const resources = [
    { kind: "official_page", url: officialUrl2, label: "Ficha oficial OECD" },
    ...validExternalUrl(detail3.externalUrl) ? [{ kind: "official_page", url: detail3.externalUrl, label: "Autoridad de origen publicada por OECD" }] : [],
    ...validExternalUrl(detail3.manufacturerUrl) ? [{ kind: "other", url: detail3.manufacturerUrl, label: "Sitio web del fabricante publicado por OECD" }] : [],
    ...validExternalUrl(detail3.distributorUrl) ? [{ kind: "other", url: detail3.distributorUrl, label: "Sitio web del distribuidor publicado por OECD" }] : [],
    ...detail3.images.map((image) => ({ kind: "image", url: oecdDocumentUrl(image.uri), label: image.alt || "Imagen oficial OECD" }))
  ].filter((resource, index2, all) => all.findIndex((candidate) => candidate.kind === resource.kind && candidate.url === resource.url) === index2);
  const priority = priorityFrom(detail3.riskLevel);
  const canonical = {
    identity: { internalId: id, source: "OECD", sourceRecordId: reference, officialReference: reference, officialUrl: officialUrl2 },
    headline: knownValue(detail3.productName, productName, seed, "product.name"),
    dates: {
      publishedAt: publishedAt ? knownValue(detail3.publishedDate, publishedAt, seed, "date") : missingValue(detail3.publishedDate === INVALID_SENTINEL_DATE ? "unknown" : "not_published"),
      detectedAt,
      officialUpdatedAt: missingValue("not_published")
    },
    lifecycle: { officialUpdate: missingValue("unknown") },
    product: {
      name: knownValue(detail3.productName, productName, seed, "product.name"),
      category: category ? knownValue(categoryCode?.description || detail3.productType, category, seed, categoryCode ? `product.code:${categoryCode.type}` : "product.type") : missingValue(),
      domain: domain.canonical,
      model: model ? knownValue(detail3.productModelAndVolume, model, seed, "product.modelAndVolume") : missingValue(),
      commercialReference: missingValue(),
      lots: missingValue(),
      identifiers
    },
    operators,
    geography: {
      originCountry: originCountries.length ? knownValue(originCountries.join(" | "), originCountries.join(" \xB7 "), seed, "manufacturer.country") : missingValue(),
      notifyingCountry: missingValue("not_published"),
      affectedTerritories: detail3.countryName ? knownValue([detail3.countryName], [detail3.countryName], seed, "countryName:economy-of-recall") : missingValue(),
      distribution: missingValue()
    },
    risk: {
      type: detail3.riskLevel ? knownValue([detail3.riskLevel], [normalizeOecdText(detail3.riskLevel)], seed, "riskLevel") : missingValue(),
      hazard: hazard ? knownValue(detail3.hazard, hazard, seed, "hazard") : missingValue(),
      description: hazard ? knownValue(detail3.hazard, hazard, seed, "hazard") : missingValue(),
      reason: missingValue(),
      measures: missingValue(),
      recommendations: action ? knownValue(detail3.action, action, seed, "action") : missingValue(),
      priority: detail3.riskLevel ? knownValue(detail3.riskLevel, priority, seed, "riskLevel") : derivedValue(priority, seed, "neutral-priority-without-oecd-risk-level")
    },
    resources,
    sourceRecord: {
      detailLevel: "detail",
      mechanisms: [
        ...context.exportRecord ? ["export"] : [],
        ...context.searchRecord ? ["search"] : [],
        ...context.rssItem ? ["rss"] : [],
        "detail"
      ],
      reference,
      uri: detail3.uri,
      portalCreatedAt: portalCreatedIso || null,
      domainNormalization: domain,
      ...productDescription ? { productDescriptionNormalized: productDescription } : {},
      detail: detail3.raw,
      ...context.exportRecord ? { export: context.exportRecord.raw } : {},
      ...context.searchRecord ? { search: context.searchRecord.raw } : {},
      ...context.rssItem ? { rss: context.rssItem.raw } : {}
    }
  };
  const contentHash = await oecdContentHash(canonical);
  const provider = operators.find((operator) => operator.role === "manufacturer") ?? operators[0];
  return {
    id,
    reference,
    source: "OECD",
    type: domain.normalized,
    priority,
    title: productName,
    product: productName,
    brand: "",
    productClass: category || "Sin clasificar",
    productKey: normalizeEntityKey(productName),
    brandKey: "",
    provider: provider?.name.normalized ?? "",
    providerKey: normalizeEntityKey(provider?.name.normalized ?? ""),
    providerRole: provider?.role === "manufacturer" ? "Fabricante" : provider?.role === "distributor" ? "Distribuidor" : "",
    providerEvidence: provider?.evidence ?? "",
    hazard: hazard || "Consultar la ficha oficial OECD",
    origin: originCountries.join(" \xB7 ") || "No indicado",
    scope: detail3.countryName ? `Retirada en ${detail3.countryName}` : "OECD Global Recalls",
    action: action || "Consultar la ficha oficial OECD",
    lots: [],
    imageUrl: resources.find((resource) => resource.kind === "image")?.url ?? null,
    url: officialUrl2,
    publishedAt: publishedAt || null,
    detectedAt,
    updatedAt: detectedAt,
    contentHash,
    versionCount: 1,
    isUpdate: false,
    canonical
  };
}
var mapLimit = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (true) {
      const index2 = next;
      next += 1;
      if (index2 >= items.length) return;
      results[index2] = await mapper(items[index2], index2);
    }
  });
  await Promise.all(workers);
  return results;
};
var consolidateByUri = (records) => {
  const unique = /* @__PURE__ */ new Map();
  let invalidRecords = 0;
  let duplicateRecords = 0;
  for (const record7 of records) {
    const reference = oecdReference(record7.uri);
    if (!reference) {
      invalidRecords += 1;
      continue;
    }
    if (unique.has(reference)) duplicateRecords += 1;
    else unique.set(reference, record7);
  }
  return { records: [...unique.values()], invalidRecords, duplicateRecords };
};
var normalizeDetails = async (records, client, detectedAt) => {
  let detailFailures = 0;
  let processed = 0;
  const failures = [];
  const alerts2 = await mapLimit(records, client.detailConcurrency ?? 5, async (record7) => {
    try {
      const detail3 = await fetchOecdDetail(record7.uri, client);
      if (oecdReference(detail3.uri) !== oecdReference(record7.uri)) {
        throw new OecdRequestError(`OECD devolvi\xF3 una identidad distinta para ${oecdReference(record7.uri)}`, "invalid-response");
      }
      const alert = await normalizeOecdDetail(detail3, detectedAt, {
        exportRecord: record7.exportRecord,
        searchRecord: record7.searchRecord,
        rssItem: record7.rssItem
      });
      processed += 1;
      if (processed % 25 === 0) await client.onDetailBatch?.(processed);
      return alert;
    } catch (error) {
      detailFailures += 1;
      failures.push({
        reference: oecdReference(record7.uri) || record7.uri,
        error: error instanceof Error ? error.message : "fallo no identificado"
      });
      return null;
    }
  });
  if (detailFailures) throw new OecdRequestError(`${detailFailures} detalles OECD no pudieron completarse (${failures.slice(0, 5).map((failure) => `${failure.reference}: ${failure.error}`).join("; ")}); la unidad no avanz\xF3`, "data-missing");
  return { alerts: alerts2.filter((alert) => Boolean(alert)), detailFailures };
};
var resultDates2 = (alerts2) => alerts2.reduce((range, alert) => ({
  oldest: minDate4(range.oldest, alert.publishedAt),
  newest: maxDate4(range.newest, alert.publishedAt)
}), { oldest: null, newest: null });
async function discoverOecdDateWindow(startDate, endDate, client = {}) {
  const exportQuery = new URLSearchParams({ beginAnnouncementDate: startDate, endAnnouncementDate: endDate });
  const searchQuery = `date GE ${startDate} AND date LE ${endDate}`;
  const [xml, search] = await Promise.all([
    requestText(`${OECD_EXPORT_ENDPOINT}?${exportQuery.toString()}`, "text/xml", client),
    fetchOecdSearchIndex(searchQuery, client)
  ]);
  const exportRecords = consolidateByUri(parseOecdExport(xml));
  const searchRecords = consolidateByUri(search.records);
  const invalidRecords = exportRecords.invalidRecords + searchRecords.invalidRecords;
  if (invalidRecords) throw new OecdRequestError(`${invalidRecords} registros OECD sin identidad entre ${startDate} y ${endDate}`, "data-missing");
  const candidates = /* @__PURE__ */ new Map();
  for (const record7 of exportRecords.records) candidates.set(oecdReference(record7.uri), { uri: record7.uri, exportRecord: record7 });
  for (const record7 of searchRecords.records) {
    const reference = oecdReference(record7.uri);
    const current = candidates.get(reference);
    candidates.set(reference, { ...current, uri: record7.uri, searchRecord: record7 });
  }
  return {
    candidates,
    pagesScanned: search.pagesScanned,
    searchRecords: search.records.length,
    exportRecords: exportRecords.records.length,
    duplicateRecords: exportRecords.duplicateRecords + searchRecords.duplicateRecords
  };
}
async function fetchOecdBackfillUnit(unit, client = {}, detectedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const discovered = await discoverOecdDateWindow(unit.startDate, unit.endDate, client);
  const candidates = [...discovered.candidates.values()].filter((record7) => {
    if (unit.partitionIndex === void 0 || unit.partitionCount === void 0) return true;
    return oecdBackfillPartitionBucket(oecdReference(record7.uri), unit.partitionCount) === unit.partitionIndex;
  });
  const normalized = await normalizeDetails(candidates, client, detectedAt);
  const dates = resultDates2(normalized.alerts);
  return {
    alerts: normalized.alerts,
    pagesScanned: discovered.pagesScanned,
    recordsObserved: unit.partitionIndex === void 0 || unit.partitionCount === void 0 ? discovered.searchRecords : [...discovered.candidates.values()].filter((record7) => record7.searchRecord && oecdBackfillPartitionBucket(oecdReference(record7.uri), unit.partitionCount) === unit.partitionIndex).length,
    duplicateRecords: discovered.duplicateRecords,
    invalidRecords: 0,
    detailFailures: normalized.detailFailures,
    oldestPublishedAt: dates.oldest,
    newestPublishedAt: dates.newest,
    nextCursor: 0,
    hasMore: false,
    discovery: {
      rssRecords: 0,
      searchRecords: discovered.searchRecords,
      exportRecords: discovered.exportRecords,
      candidates: discovered.candidates.size
    }
  };
}
var isoDate3 = (date) => date.toISOString().slice(0, 10);
var OECD_DAILY_BACKFILL_START = "2019-12-01";
var OECD_DAILY_PARTITIONS = {
  "2019-12-13": 2,
  "2019-12-15": 4,
  "2020-02-05": 5,
  "2020-03-31": 5,
  "2020-12-10": 2,
  "2021-02-25": 2,
  "2021-05-31": 2,
  "2022-07-06": 2,
  "2023-06-28": 2,
  "2023-08-29": 2,
  "2023-09-21": 3,
  "2024-02-29": 2,
  "2024-04-30": 2,
  "2024-06-27": 3,
  "2024-08-06": 2,
  "2024-08-08": 2,
  "2024-08-13": 3,
  "2024-11-28": 2,
  "2024-12-05": 2,
  "2024-12-12": 2,
  "2025-02-27": 3,
  "2025-04-03": 2,
  "2025-04-08": 2,
  "2025-04-10": 2,
  "2025-06-17": 2,
  "2025-07-17": 2,
  "2025-10-30": 2,
  "2026-02-26": 2
};
var oecdBackfillPartitionBucket = (reference, partitions) => {
  let hash2 = 2166136261;
  for (let index2 = 0; index2 < reference.length; index2 += 1) {
    hash2 ^= reference.charCodeAt(index2);
    hash2 = Math.imul(hash2, 16777619);
  }
  return (hash2 >>> 0) % Math.max(1, partitions);
};
function fetchOecdBackfillPlan(now = /* @__PURE__ */ new Date()) {
  const units = [{ key: "1900-1998", startDate: "1900-01-01", endDate: "1998-12-31" }];
  const lastYear = now.getUTCFullYear();
  const lastMonth = now.getUTCMonth() + 1;
  for (let year = 1999; year <= lastYear; year += 1) {
    const endMonth = year === lastYear ? lastMonth : 12;
    for (let month = 1; month <= endMonth; month += 1) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      if (isoDate3(start) >= OECD_DAILY_BACKFILL_START) {
        for (let day = 1; day <= end.getUTCDate(); day += 1) {
          const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const partitionCount = OECD_DAILY_PARTITIONS[date] ?? 1;
          for (let partitionIndex = 0; partitionIndex < partitionCount; partitionIndex += 1) {
            units.push({
              key: partitionCount === 1 ? date : `${date}-p${partitionIndex + 1}of${partitionCount}`,
              startDate: date,
              endDate: date,
              ...partitionCount === 1 ? {} : { partitionIndex, partitionCount }
            });
          }
        }
        continue;
      }
      units.push({
        key: `${year}-${String(month).padStart(2, "0")}-a`,
        startDate: isoDate3(start),
        endDate: `${year}-${String(month).padStart(2, "0")}-15`
      });
      units.push({
        key: `${year}-${String(month).padStart(2, "0")}-b`,
        startDate: `${year}-${String(month).padStart(2, "0")}-16`,
        endDate: isoDate3(end)
      });
    }
  }
  return units;
}
var portalTime = (item) => {
  return parseOecdPortalTime(item.portalPublishedAt);
};
async function fetchOecdRecent(cursorSeconds = 0, client = {}, detectedAt = (/* @__PURE__ */ new Date()).toISOString(), recoveryStart = null) {
  const nowMs = Date.parse(detectedAt);
  if (!Number.isFinite(nowMs)) throw new OecdRequestError("La fecha de ejecuci\xF3n OECD no es v\xE1lida", "invalid-response");
  const endDate = isoDate3(new Date(nowMs));
  const startDate = isoDate3(new Date(nowMs - (OECD_RECENT_RECONCILIATION_DAYS - 1) * 24 * 60 * 6e4));
  const recentQuery = `date GE ${startDate} AND date LE ${endDate}`;
  const [rssXml, search] = await Promise.all([
    requestText(OECD_RSS_ENDPOINT, "application/rss+xml, text/xml", client),
    fetchOecdSearchIndex(recentQuery, client, 20)
  ]);
  const rss = parseOecdRss(rssXml);
  const consolidated = consolidateByUri(rss);
  const invalidPortalDates = consolidated.records.filter((item) => portalTime(item) === null);
  if (invalidPortalDates.length) {
    throw new OecdRequestError(`El RSS OECD contiene ${invalidPortalDates.length} fechas de publicaci\xF3n ilegibles`, "invalid-response");
  }
  const ordered3 = consolidated.records.sort((left, right) => (portalTime(left) ?? 0) - (portalTime(right) ?? 0) || left.uri.localeCompare(right.uri));
  const candidates = /* @__PURE__ */ new Map();
  for (const record7 of search.records) candidates.set(oecdReference(record7.uri), { uri: record7.uri, searchRecord: record7 });
  for (const item of ordered3) {
    const reference = oecdReference(item.uri);
    const current = candidates.get(reference);
    candidates.set(reference, { ...current, uri: current?.uri ?? item.uri, rssItem: item });
  }
  let gapPages = 0, gapSearchRecords = 0, gapExportRecords = 0, gapDuplicates = 0;
  const exportReferences = /* @__PURE__ */ new Set();
  const searchReferences = new Set(search.records.map((record7) => oecdReference(record7.uri)));
  if (recoveryStart && Date.parse(detectedAt) - Date.parse(recoveryStart) > RSS_WINDOW_MS) {
    const gapStartDate = isoDate3(new Date(recoveryStart));
    const gap = await discoverOecdDateWindow(gapStartDate, endDate, client);
    gapPages = gap.pagesScanned;
    gapSearchRecords = gap.searchRecords;
    gapExportRecords = gap.exportRecords;
    gapDuplicates = gap.duplicateRecords;
    for (const [reference, record7] of gap.candidates) {
      if (record7.exportRecord) exportReferences.add(reference);
      if (record7.searchRecord) searchReferences.add(reference);
      const current = candidates.get(reference);
      candidates.set(reference, {
        ...record7,
        ...current,
        uri: current?.uri ?? record7.uri,
        exportRecord: record7.exportRecord ?? current?.exportRecord,
        searchRecord: current?.searchRecord ?? record7.searchRecord,
        rssItem: current?.rssItem
      });
    }
  }
  const maximum = Math.max(1, Math.min(RECENT_CANDIDATE_LIMIT, Math.trunc(client.recentBatchSize ?? RECENT_CANDIDATE_LIMIT)));
  if (candidates.size > maximum) {
    throw new OecdRequestError(`OECD recent reuni\xF3 ${candidates.size} candidatos y supera el lote seguro ${maximum}`, "pagination");
  }
  const normalized = await normalizeDetails([...candidates.values()], client, detectedAt);
  const currentCursorMs = cursorSeconds > 0 ? cursorSeconds * 1e3 : 0;
  const nextCursorMs = ordered3.reduce((latest, item) => Math.max(latest, portalTime(item) ?? latest), currentCursorMs);
  const dates = resultDates2(normalized.alerts);
  return {
    alerts: normalized.alerts,
    pagesScanned: 1 + search.pagesScanned + gapPages,
    recordsObserved: rss.length + search.records.length + gapSearchRecords + gapExportRecords,
    duplicateRecords: consolidated.duplicateRecords + gapDuplicates,
    invalidRecords: consolidated.invalidRecords,
    detailFailures: normalized.detailFailures,
    oldestPublishedAt: dates.oldest,
    newestPublishedAt: dates.newest,
    nextCursor: Math.max(cursorSeconds, Math.floor(nextCursorMs / 1e3)),
    hasMore: false,
    discovery: {
      rssRecords: rss.length,
      searchRecords: search.records.length + gapSearchRecords,
      exportRecords: gapExportRecords,
      candidates: candidates.size,
      malformedRecords: consolidated.invalidRecords
    },
    surfaceReferences: {
      rss: [...new Set(ordered3.map((item) => oecdReference(item.uri)))].sort(),
      search: [...searchReferences].sort(),
      export: [...exportReferences].sort()
    }
  };
}
var oecdRecentWindowMilliseconds = () => RSS_WINDOW_MS;

// candidate-probe-v4-src/lib/oecd-sync.ts
var OECD_HISTORICAL_RECONCILE_PLAN_VERSION = "oecd-historical-reconcile-v2";
var nowIso4 = (options = {}) => (options.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
var errorMessage4 = (error) => error instanceof Error ? error.message : "Error OECD no identificado";
var minDate5 = (a, b) => !b ? a : !a || b < a ? b : a;
var maxDate5 = (a, b) => !b ? a : !a || b > a ? b : a;
var emptyState4 = (mode, now = (/* @__PURE__ */ new Date()).toISOString()) => ({
  source: "OECD",
  mode,
  status: "idle",
  cursor: 0,
  planVersion: null,
  cursorKey: null,
  totalUnits: 0,
  pagesScanned: 0,
  recordsObserved: 0,
  recordsPersisted: 0,
  newCount: 0,
  updatedCount: 0,
  detailFailures: 0,
  pageErrors: 0,
  oldestPublishedAt: null,
  newestPublishedAt: null,
  coverage: "unknown",
  startedAt: null,
  lastSuccessAt: null,
  completedAt: null,
  lastError: null,
  leaseOwnerId: null,
  leaseMode: null,
  leaseExpiresAt: null,
  lastSkippedAt: null,
  lastSkipReason: null,
  lastSkippedOwnerId: null,
  updatedAt: now
});
var syncState2 = (store) => {
  if (!store.readSyncState || !store.writeSyncState) throw new Error("AlertStore no dispone de estado de sincronizaci\xF3n");
  return { read: store.readSyncState.bind(store), write: store.writeSyncState.bind(store) };
};
async function skipped2(store, mode, ownerId, active, options, reason = "already-running") {
  const at = nowIso4(options);
  const previous = await store.readSyncState?.("OECD", mode) ?? emptyState4(mode, at);
  await store.recordSyncSkip?.("OECD", mode, ownerId, at, reason);
  return {
    ...previous,
    status: "skipped",
    leaseOwnerId: active?.ownerId ?? null,
    leaseMode: active?.mode ?? null,
    leaseExpiresAt: active?.expiresAt ?? null,
    lastSkippedAt: at,
    lastSkipReason: reason,
    lastSkippedOwnerId: ownerId,
    updatedAt: at
  };
}
async function runOecdRecentSync(store, client = {}, options = {}) {
  const sync = syncState2(store);
  const lease = await acquireSourceLease(store, "OECD", "recent", options);
  if (!lease.acquired) return skipped2(store, "recent", lease.ownerId, lease.lease, options);
  try {
    if (await store.findOecdSnapshot?.(["backfill-running"])) return await skipped2(store, "recent", lease.ownerId, null, options, "backfill-active");
    const startedAt = nowIso4(options);
    const previous = await sync.read("OECD", "recent") ?? emptyState4("recent", startedAt);
    const running = {
      ...previous,
      status: "running",
      totalUnits: 1,
      pagesScanned: 0,
      recordsObserved: 0,
      recordsPersisted: 0,
      newCount: 0,
      updatedCount: 0,
      detailFailures: 0,
      pageErrors: 0,
      oldestPublishedAt: null,
      newestPublishedAt: null,
      coverage: "partial",
      startedAt,
      completedAt: null,
      lastError: null,
      leaseOwnerId: lease.ownerId,
      leaseMode: "recent",
      leaseExpiresAt: lease.lease.expiresAt,
      updatedAt: startedAt
    };
    await sync.write(running);
    try {
      const gapRecovery = Boolean(previous.cursor > 0 && previous.lastSuccessAt && Date.parse(startedAt) - Date.parse(previous.lastSuccessAt) > oecdRecentWindowMilliseconds());
      if (gapRecovery && !options.reconciliationSnapshotId) {
        throw new OecdRequestError("La recuperaci\xF3n del gap OECD requiere un snapshot dirigido verificado", "recent-gap");
      }
      const fetched = await fetchOecdRecent(previous.cursor, client, startedAt, gapRecovery ? previous.lastSuccessAt : null);
      if (gapRecovery) {
        await verifyOecdReconciliationSnapshotForWrite(store, options.reconciliationSnapshotId, fetched.alerts.map((alert) => alert.id));
      }
      const renewed = await lease.renew();
      running.leaseExpiresAt = renewed.expiresAt;
      await sync.write(running);
      const persisted = await store.persistSuccess("OECD", fetched.alerts, { ownerId: lease.ownerId, now: () => nowIso4(options) });
      await lease.renew();
      if (gapRecovery) await completeOecdSnapshotBackfill(store, options.reconciliationSnapshotId, nowIso4(options));
      const completedAt = nowIso4(options);
      const state = {
        ...running,
        status: fetched.hasMore ? "partial" : "completed",
        cursor: fetched.nextCursor,
        pagesScanned: fetched.pagesScanned,
        recordsObserved: fetched.recordsObserved,
        recordsPersisted: (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
        newCount: persisted.newCount ?? 0,
        updatedCount: persisted.updatedCount ?? 0,
        detailFailures: fetched.detailFailures,
        oldestPublishedAt: fetched.oldestPublishedAt,
        newestPublishedAt: fetched.newestPublishedAt,
        lastSuccessAt: completedAt,
        completedAt: fetched.hasMore ? null : completedAt,
        lastError: fetched.hasMore ? "Quedan grupos de publicaci\xF3n RSS por procesar" : null,
        leaseOwnerId: null,
        leaseMode: null,
        leaseExpiresAt: null,
        updatedAt: completedAt
      };
      await sync.write(state);
      return state;
    } catch (error) {
      const at = nowIso4(options);
      const failed = {
        ...running,
        status: "failed",
        pageErrors: 1,
        lastError: errorMessage4(error),
        leaseOwnerId: null,
        leaseMode: null,
        leaseExpiresAt: null,
        updatedAt: at
      };
      if (!(error instanceof SyncLeaseLostError)) {
        try {
          await store.persistFailure("OECD", error, { ownerId: lease.ownerId, now: () => nowIso4(options) });
        } catch {
        }
        await sync.write(failed);
      }
      return failed;
    }
  } finally {
    await lease.release();
  }
}
async function runOecdHistoricalReconcileBatch(store, batchSize = 12, client = {}, options = {}) {
  const sync = syncState2(store);
  const lease = await acquireSourceLease(store, "OECD", "historical-reconcile", options);
  if (!lease.acquired) return skipped2(store, "historical-reconcile", lease.ownerId, lease.lease, options);
  try {
    const startedAt = nowIso4(options);
    const plan = fetchOecdBackfillPlan(options.now?.() ?? /* @__PURE__ */ new Date());
    const stored = await sync.read("OECD", "historical-reconcile");
    const continuing = stored?.planVersion?.startsWith(`${OECD_HISTORICAL_RECONCILE_PLAN_VERSION}:`) === true && stored.status !== "completed";
    const previous = continuing ? stored : emptyState4("historical-reconcile", startedAt);
    const planVersion = continuing ? stored.planVersion : `${OECD_HISTORICAL_RECONCILE_PLAN_VERSION}:${startedAt}`;
    const expectedKey = plan[previous.cursor]?.key ?? (previous.cursor === plan.length ? "complete" : null);
    if (!expectedKey || previous.cursor > 0 && previous.cursorKey !== plan[previous.cursor - 1]?.key) {
      const failed = {
        ...previous,
        status: "failed",
        pageErrors: previous.pageErrors + 1,
        lastError: "El cursor diario OECD no coincide con el plan oficial",
        updatedAt: startedAt
      };
      await sync.write(failed);
      return failed;
    }
    let running = {
      ...previous,
      status: "running",
      planVersion,
      totalUnits: plan.length,
      coverage: previous.cursor ? "partial" : "unknown",
      startedAt: previous.startedAt ?? startedAt,
      completedAt: null,
      lastError: null,
      leaseOwnerId: lease.ownerId,
      leaseMode: "historical-reconcile",
      leaseExpiresAt: lease.lease.expiresAt,
      updatedAt: startedAt
    };
    await sync.write(running);
    const selected = plan.slice(running.cursor, running.cursor + Math.max(1, Math.min(12, Math.trunc(batchSize))));
    for (const unit of selected) {
      try {
        const fetched = await fetchOecdBackfillUnit(unit, {
          ...client,
          onDetailBatch: async (processed) => {
            await client.onDetailBatch?.(processed);
            await lease.renew();
          }
        }, startedAt);
        await lease.renew();
        const persisted = await store.persistSuccess("OECD", fetched.alerts, { ownerId: lease.ownerId, now: () => nowIso4(options) });
        const renewed = await lease.renew();
        const nextCursor = running.cursor + 1;
        const at2 = nowIso4(options);
        running = {
          ...running,
          status: nextCursor >= plan.length ? "completed" : "partial",
          cursor: nextCursor,
          cursorKey: unit.key,
          pagesScanned: running.pagesScanned + fetched.pagesScanned,
          recordsObserved: running.recordsObserved + fetched.recordsObserved,
          recordsPersisted: running.recordsPersisted + (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
          newCount: running.newCount + (persisted.newCount ?? 0),
          updatedCount: running.updatedCount + (persisted.updatedCount ?? 0),
          oldestPublishedAt: minDate5(running.oldestPublishedAt, fetched.oldestPublishedAt),
          newestPublishedAt: maxDate5(running.newestPublishedAt, fetched.newestPublishedAt),
          coverage: nextCursor >= plan.length ? "official-index-complete" : "partial",
          lastSuccessAt: at2,
          completedAt: nextCursor >= plan.length ? at2 : null,
          leaseExpiresAt: renewed.expiresAt,
          updatedAt: at2
        };
        await sync.write(running);
      } catch (error) {
        const at2 = nowIso4(options);
        const failed = {
          ...running,
          status: "partial",
          pageErrors: running.pageErrors + 1,
          lastError: errorMessage4(error),
          leaseOwnerId: null,
          leaseMode: null,
          leaseExpiresAt: null,
          updatedAt: at2
        };
        if (!(error instanceof SyncLeaseLostError)) await sync.write(failed);
        return failed;
      }
    }
    const at = nowIso4(options);
    const finalState = { ...running, leaseOwnerId: null, leaseMode: null, leaseExpiresAt: null, updatedAt: at };
    await sync.write(finalState);
    return finalState;
  } finally {
    await lease.release();
  }
}

// candidate-probe-v4-src/lib/safety-gate.ts
var SAFETY_GATE_BASE = "https://ec.europa.eu/safety-gate-alerts";
var SAFETY_GATE_RECENT_ENDPOINT = `${SAFETY_GATE_BASE}/public/api/notification/mostRecent/?`;
var SAFETY_GATE_CAROUSEL_ENDPOINT = `${SAFETY_GATE_BASE}/public/api/notification/carousel/?`;
var SAFETY_GATE_REPORT_INDEX_ENDPOINT = `${SAFETY_GATE_BASE}/api/download/weeklyReport/list/xml/en`;
var SafetyGateRequestError = class extends Error {
  constructor(message, kind, status = null) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.name = "SafetyGateRequestError";
  }
};
var riskLabels = {
  "riskType.chemical": "Riesgo qu\xEDmico",
  "riskType.choking": "Asfixia",
  "riskType.strangulation": "Estrangulamiento",
  "riskType.electric.shock": "Descarga el\xE9ctrica",
  "riskType.fire": "Incendio",
  "riskType.injuries": "Lesiones",
  "riskType.environment": "Riesgo medioambiental",
  "riskType.burns": "Quemaduras",
  "riskType.microbiological": "Riesgo microbiol\xF3gico",
  "riskType.damage.to.hearing": "Da\xF1os auditivos",
  "riskType.damage.to.sight": "Da\xF1os oculares",
  "riskType.cuts": "Cortes",
  "riskType.drowning": "Ahogamiento",
  "riskType.suffocation": "Asfixia",
  "riskType.entrapment": "Atrapamiento",
  "riskType.fall": "Ca\xEDdas",
  "riskType.health.risk.other": "Otro riesgo para la salud"
};
var publishedRiskAliases = {
  chemical: "riskType.chemical",
  choking: "riskType.choking",
  strangulation: "riskType.strangulation",
  "electric shock": "riskType.electric.shock",
  fire: "riskType.fire",
  injuries: "riskType.injuries",
  environment: "riskType.environment",
  burns: "riskType.burns",
  microbiological: "riskType.microbiological",
  "damage to hearing": "riskType.damage.to.hearing",
  "damage to sight": "riskType.damage.to.sight",
  cuts: "riskType.cuts",
  drowning: "riskType.drowning",
  suffocation: "riskType.suffocation",
  entrapment: "riskType.entrapment",
  fall: "riskType.fall",
  "health risk / other": "riskType.health.risk.other"
};
var measureLabels = {
  BAN_MARKETING_OF_PRODUCT: "Prohibici\xF3n de comercializaci\xF3n",
  PRODUCT_RECALL_FROM_CONSUMERS: "Recuperaci\xF3n del producto de los consumidores",
  WITHDRAWAL_OF_PRODUCT_FROM_THE_MARKET: "Retirada del producto del mercado",
  DESTRUCTION_OF_PRODUCT: "Destrucci\xF3n del producto",
  WARNING_CONSUMERS_OF_THE_RISKS: "Advertencia a los consumidores",
  IMPORT_REJECTED_AT_BORDER: "Importaci\xF3n rechazada en frontera",
  PRODUCT_WITHDRAWAL_FROM_MARKET: "Retirada del producto del mercado",
  MARKING_PRODUCT_WARNINGS: "Marcado del producto con advertencias adecuadas",
  REMOVAL_FROM_ONLINE_MARKETPLACE: "Retirada del mercado en l\xEDnea",
  WARNING_CONSUMERS_OF_RISKS: "Advertencia a los consumidores",
  STOP_OF_SALES: "Cese de las ventas",
  "Recall of the product from end users": "Recuperaci\xF3n del producto de los consumidores",
  "Withdrawal of the product from the market": "Retirada del producto del mercado",
  "Ban on the marketing of the product and any accompanying measures": "Prohibici\xF3n de comercializaci\xF3n",
  "Destruction of the product": "Destrucci\xF3n del producto",
  "Warning consumers of the risks": "Advertencia a los consumidores"
};
var xmlParser2 = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  trimValues: true,
  processEntities: true
});
var defaultSleep3 = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
var deterministicTextKey = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
var deterministicTextCompare = (left, right) => {
  const leftKey = deterministicTextKey(left);
  const rightKey = deterministicTextKey(right);
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : left < right ? -1 : left > right ? 1 : 0;
};
var cleanStrings = (values) => [...new Set(
  values.map((value) => value?.trim()).filter((value) => Boolean(value))
)].sort(deterministicTextCompare);
var stableJsonValue2 = (value) => {
  if (Array.isArray(value)) return value.map(stableJsonValue2);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en")).map(([key, child]) => [key, stableJsonValue2(child)]));
  }
  return value;
};
var indexProjection = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value;
  const id = Number(row.id);
  const reference = typeof row.reference === "string" ? row.reference.trim() : "";
  if (!Number.isSafeInteger(id) || !reference) return null;
  const product = row.product && typeof row.product === "object" && !Array.isArray(row.product) ? row.product : {};
  const risk = row.risk && typeof row.risk === "object" && !Array.isArray(row.risk) ? row.risk : {};
  const brands = Array.isArray(product.brands) ? product.brands.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const brand = entry.brand;
    return typeof brand === "string" && brand.trim() ? [brand.trim()] : [];
  }).sort(deterministicTextCompare) : [];
  const photos = Array.isArray(product.photos) ? product.photos.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const photo = entry;
    const photoId = Number(photo.id);
    const url = typeof photo.url === "string" ? photo.url.trim() : "";
    return [{
      id: Number.isSafeInteger(photoId) ? photoId : null,
      mainPicture: photo.mainPicture === true,
      url: url || null
    }];
  }).sort((left, right) => (left.id ?? 0) - (right.id ?? 0) || String(left.url ?? "").localeCompare(String(right.url ?? ""), "en")) : [];
  const riskTypes = Array.isArray(risk.riskType) ? risk.riskType.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry;
    const key = typeof item.key === "string" ? item.key.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    return key || name ? [{ key, name }] : [];
  }).sort((left, right) => left.key.localeCompare(right.key, "en") || left.name.localeCompare(right.name, "en")) : [];
  return {
    id,
    reference,
    publicationDate: typeof row.publicationDate === "string" ? row.publicationDate.trim() : "",
    modificationDate: typeof row.modificationDate === "string" ? row.modificationDate.trim() : "",
    officialUrl: typeof row.officialUrl === "string" ? row.officialUrl.trim() : "",
    corrigendum: stableJsonValue2(row.corrigendum ?? null),
    product: {
      name: typeof product.name === "string" ? product.name.trim() : "",
      brands,
      photos
    },
    risk: { riskType: riskTypes }
  };
};
var safetyGateIndexRevisionFingerprint = (value) => {
  const projection = indexProjection(value);
  return projection ? JSON.stringify(projection) : null;
};
function selectSafetyGateDetailCandidates(items, storedAlerts) {
  const storedByReference = new Map(storedAlerts.filter((alert) => alert.source === "SAFETY GATE").map((alert) => [alert.reference, alert]));
  const candidates = [];
  const skipped3 = [];
  const reasons = {
    new: 0,
    "missing-index-baseline": 0,
    "identity-change": 0,
    "index-change": 0
  };
  for (const item of items) {
    const current = storedByReference.get(item.reference);
    let reason = null;
    if (!current) reason = "new";
    else if (current.canonical.identity.sourceRecordId !== String(item.id)) reason = "identity-change";
    else {
      const before = safetyGateIndexRevisionFingerprint(current.canonical.sourceRecord?.summary);
      const after = safetyGateIndexRevisionFingerprint(item);
      if (!before) reason = "missing-index-baseline";
      else if (before !== after) reason = "index-change";
    }
    if (reason) {
      reasons[reason] += 1;
      candidates.push(item);
    } else {
      skipped3.push(item);
    }
  }
  return { candidates, skipped: skipped3, reasons };
}
var asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
var scalarText = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && "#text" in value) return scalarText(value["#text"]);
  return "";
};
var firstField = (record7, names) => {
  for (const name of names) {
    const value = scalarText(record7[name]);
    if (value) return value;
  }
  return "";
};
var fieldValues = (record7, names) => cleanStrings(names.flatMap(
  (name) => asArray(record7[name]).map(scalarText)
));
var nestedFieldValues = (record7, names) => {
  const wanted = new Set(names);
  const values = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, candidate] of Object.entries(value)) {
      if (wanted.has(key)) values.push(...asArray(candidate).map(scalarText));
      visit(candidate);
    }
  };
  visit(record7);
  return cleanStrings(values);
};
var collectObjects = (value, key, found = []) => {
  if (!value || typeof value !== "object") return found;
  for (const [candidateKey, candidateValue] of Object.entries(value)) {
    if (candidateKey === key) {
      for (const entry of asArray(candidateValue)) {
        if (entry && typeof entry === "object") found.push(entry);
      }
    }
    collectObjects(candidateValue, key, found);
  }
  return found;
};
var parseOfficialUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "ec.europa.eu" || !url.pathname.startsWith("/safety-gate-alerts/")) return null;
    return url.toString();
  } catch {
    return null;
  }
};
var parseAlertId = (record7, officialUrl2) => {
  const urlMatch = officialUrl2.match(/(?:alertDetail|detail)\/(-?\d+)/i);
  if (urlMatch) return Number(urlMatch[1]);
  const explicit = firstField(record7, ["notificationId", "notificationID", "alertId", "alertID", "id"]);
  return /^\d+$/.test(explicit) ? Number(explicit) : null;
};
var parseDate = (value) => {
  const trimmed = value.trim();
  const european = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (european) return `${european[3]}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}T00:00:00.000Z`;
  const timestamp2 = Date.parse(trimmed);
  return Number.isFinite(timestamp2) ? new Date(timestamp2).toISOString() : "";
};
var splitPublishedList = (value) => cleanStrings(value.split(/\r?\n|\s*;\s*|\s*\|\s*/g));
var splitPublishedRisks = (value) => cleanStrings(value.split(/\r?\n|\s*;\s*|\s*\|\s*|\s*,\s*/g));
var riskEntriesFromPublished = (value) => splitPublishedRisks(value).map((name) => ({
  key: publishedRiskAliases[name.toLowerCase()] ?? name,
  name
}));
var retryableStatus3 = (status) => status === 408 || status === 425 || status === 429 || status >= 500;
async function request(url, responseType, init, client = {}) {
  const fetchImpl = client.fetchImpl ?? fetch;
  const sleep = client.sleep ?? defaultSleep3;
  const retries = client.retries ?? 2;
  const timeoutMs = client.timeoutMs ?? 2e4;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "Accept": responseType === "json" ? "application/json" : "application/xml,text/xml", ...init?.headers ?? {} }
      });
      if (!response.ok) {
        const error = new SafetyGateRequestError(`Safety Gate respondi\xF3 con estado ${response.status}`, "http", response.status);
        if (!retryableStatus3(response.status) || attempt === retries) throw error;
        lastError = error;
        const retryAfter = Number(response.headers.get("Retry-After"));
        await sleep(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1e3, 5e3) : 250 * (attempt + 1));
        continue;
      }
      try {
        return responseType === "json" ? await response.json() : await response.text();
      } catch (error) {
        throw new SafetyGateRequestError(`Safety Gate devolvi\xF3 ${responseType === "json" ? "JSON" : "XML"} inv\xE1lido: ${error instanceof Error ? error.message : "respuesta ilegible"}`, "invalid-response");
      }
    } catch (error) {
      if (error instanceof SafetyGateRequestError && (error.kind === "invalid-response" || !retryableStatus3(error.status ?? 0))) throw error;
      lastError = error;
      if (attempt === retries) {
        const timeout = error instanceof Error && /abort|timeout/i.test(`${error.name} ${error.message}`);
        throw error instanceof SafetyGateRequestError ? error : new SafetyGateRequestError(
          timeout ? "Safety Gate agot\xF3 el tiempo de respuesta" : "No se pudo conectar con Safety Gate",
          timeout ? "timeout" : "network"
        );
      }
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new SafetyGateRequestError("Safety Gate no respondi\xF3", "network");
}
var requestJson4 = (url, init, client) => request(url, "json", init, client);
var requestText2 = (url, client) => request(url, "text", void 0, client);
var safetyGateCountryNames = /* @__PURE__ */ new Map([
  ["AL", "Albania"],
  ["AT", "Austria"],
  ["BD", "Banglad\xE9s"],
  ["BE", "B\xE9lgica"],
  ["BG", "Bulgaria"],
  ["CI", "C\xF4te d\u2019Ivoire"],
  ["CN", "China"],
  ["CY", "Chipre"],
  ["CZ", "Chequia"],
  ["DE", "Alemania"],
  ["DK", "Dinamarca"],
  ["EE", "Estonia"],
  ["ES", "Espa\xF1a"],
  ["FI", "Finlandia"],
  ["FR", "Francia"],
  ["GR", "Grecia"],
  ["HR", "Croacia"],
  ["HU", "Hungr\xEDa"],
  ["IE", "Irlanda"],
  ["IN", "India"],
  ["IT", "Italia"],
  ["JP", "Jap\xF3n"],
  ["KH", "Camboya"],
  ["KR", "Corea del Sur"],
  ["LT", "Lituania"],
  ["LU", "Luxemburgo"],
  ["LV", "Letonia"],
  ["MA", "Marruecos"],
  ["MT", "Malta"],
  ["MX", "M\xE9xico"],
  ["NL", "Pa\xEDses Bajos"],
  ["NO", "Noruega"],
  ["PH", "Filipinas"],
  ["PK", "Pakist\xE1n"],
  ["PL", "Polonia"],
  ["PT", "Portugal"],
  ["RO", "Ruman\xEDa"],
  ["RS", "Serbia"],
  ["SE", "Suecia"],
  ["SI", "Eslovenia"],
  ["SK", "Eslovaquia"],
  ["TH", "Tailandia"],
  ["TR", "Turqu\xEDa"],
  ["TW", "Taiw\xE1n"],
  ["UA", "Ucrania"],
  ["UK", "Reino Unido"],
  ["US", "Estados Unidos"],
  ["XI", "Irlanda del Norte"],
  ["ZA", "Sud\xE1frica"]
]);
var canonicalSafetyGateRegion = (region) => {
  if (!region) return void 0;
  const key = region.key?.trim().toUpperCase() ?? "";
  return safetyGateCountryNames.get(key) ?? (region.name?.trim() || key || void 0);
};
var priorityFor = (reference, risks) => {
  if (reference.startsWith("SR/") || risks.some((risk) => /choking|strangulation|electric|fire|chemical/i.test(risk))) return "Alta";
  return "Media";
};
var normalizedMeasure = (published) => measureLabels[published] ?? (/^[A-Z0-9_]+$/.test(published) ? published.replaceAll("_", " ").toLowerCase() : published);
async function normalizeSafetyGateRecord(item, detail3 = null, detectedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const reference = item.reference.trim();
  const officialUrl2 = parseOfficialUrl(item.officialUrl ?? "") ?? `${SAFETY_GATE_BASE}/screen/webReport/alertDetail/${item.id}?lang=es`;
  const id = sourceScopedId("SAFETY GATE", reference);
  const seed = { source: "SAFETY GATE", sourceRecordId: String(item.id), officialUrl: officialUrl2 };
  const version2 = detail3?.product.versions?.find((entry) => entry.language?.key === "ES") ?? detail3?.product.versions?.[0];
  const riskVersion = detail3?.risk?.versions?.find((entry) => entry.language?.key === "ES") ?? detail3?.risk?.versions?.[0];
  const productPublished = version2?.name?.trim() || item.product.name.trim();
  const productPresentation = productPublished || "Producto no publicado";
  const riskEntries = detail3?.risk?.riskType?.length ? detail3.risk.riskType : item.risk?.riskType ?? [];
  const riskKeys = cleanStrings(riskEntries.map((risk) => risk.key));
  const hazardLabels = cleanStrings(riskEntries.map((risk) => riskLabels[risk.key] ?? risk.name ?? risk.key));
  const hazard = hazardLabels.join(" \xB7 ") || "Consultar riesgo oficial";
  const brands = cleanStrings((detail3?.product.brands?.length ? detail3.product.brands : item.product.brands ?? []).map((entry) => entry.brand));
  const brand = brands.join(", ");
  const lots = cleanStrings(detail3?.product.batchNumbers?.map((entry) => entry.batchNumber) ?? []);
  const models = cleanStrings(detail3?.product.modelTypes?.map((entry) => entry.modelType) ?? []);
  const barcodes = cleanStrings(detail3?.product.barcodes?.map((entry) => entry.barcode) ?? []);
  const measurePublished = cleanStrings(detail3?.measureTaken?.measures?.map((measure) => measure.measureCategory?.name) ?? []);
  const measures2 = measurePublished.map(normalizedMeasure);
  const originPublished = detail3?.traceability?.countryOrigin?.name?.trim() || detail3?.traceability?.countryOrigin?.key?.trim() || "";
  const absentOrigin = (detail3?.traceability?.countryOrigin?.key ?? detail3?.traceability?.countryOrigin?.name)?.trim().toUpperCase() === "XX";
  const origin = absentOrigin ? "" : canonicalSafetyGateRegion(detail3?.traceability?.countryOrigin)?.trim() || "";
  const notifyingPublished = detail3?.country?.name?.trim() || detail3?.country?.key?.trim() || "";
  const notifyingCountry = canonicalSafetyGateRegion(detail3?.country)?.trim() || "";
  const categoryPublished = detail3?.product.productCategory?.name?.trim() || "";
  const priority = priorityFor(reference, riskKeys);
  const availablePhotos = detail3?.product.photos?.length ? detail3.product.photos : item.product.photos;
  const mainPhoto = availablePhotos?.find((photo) => photo.mainPicture) ?? availablePhotos?.[0];
  const imageUrl = parseOfficialUrl(mainPhoto?.url ?? "") ?? (mainPhoto?.id ? `${SAFETY_GATE_BASE}/public/api/notification/image/${mainPhoto.id}` : null);
  const productValue = textValue(productPublished, productPublished, seed, detail3 ? "product.versions[0].name" : "product.name");
  const categoryValue = textValue(categoryPublished, categoryPublished, seed, "product.productCategory.name");
  const originValue = origin ? textValue(originPublished, origin, seed, "traceability.countryOrigin") : missingValue(originPublished ? "unknown" : "not_published");
  const notifyingValue = notifyingCountry ? textValue(notifyingPublished, notifyingCountry, seed, "country") : missingValue();
  const hazardValue = hazardLabels.length ? knownValue(riskEntries.map((risk) => risk.name || risk.key).join(" \xB7 "), hazard, seed, "risk.riskType") : missingValue();
  const title = `${productPresentation} \u2014 ${hazard.toLowerCase()}`;
  const corrigendum = typeof (detail3?.corrigendum ?? item.corrigendum) === "string" ? String(detail3?.corrigendum ?? item.corrigendum).trim() : "";
  const officialUpdate = Boolean(corrigendum);
  const modificationDate = detail3?.modificationDate ?? item.modificationDate;
  const allPhotos = [...new Map((availablePhotos ?? []).flatMap((photo) => {
    const url = parseOfficialUrl(photo.url ?? "") ?? (photo.id ? `${SAFETY_GATE_BASE}/public/api/notification/image/${photo.id}` : null);
    return url ? [[url, { ...photo, url }]] : [];
  })).values()];
  allPhotos.sort((left, right) => Number(right.mainPicture) - Number(left.mainPicture) || left.url.localeCompare(right.url));
  const canonical = {
    identity: { internalId: id, source: "SAFETY GATE", sourceRecordId: String(item.id), officialReference: reference, officialUrl: officialUrl2 },
    headline: derivedValue(title, seed, "headline"),
    dates: {
      publishedAt: textValue(item.publicationDate, item.publicationDate, seed, "publicationDate", "unknown"),
      detectedAt,
      officialUpdatedAt: officialUpdate ? textValue(modificationDate, modificationDate, seed, "modificationDate", "unknown") : missingValue("not_applicable")
    },
    lifecycle: { officialUpdate: knownValue(officialUpdate, officialUpdate, seed, detail3 ? "corrigendum" : "hasBeenUpdated") },
    product: {
      name: productValue,
      category: categoryValue,
      domain: "No alimentaria",
      model: models.length ? knownValue(models.join(" \xB7 "), models.join(" \xB7 "), seed, "product.modelTypes") : missingValue(),
      commercialReference: missingValue(),
      lots: lots.length ? knownValue(lots, lots, seed, "product.batchNumbers") : missingValue(),
      identifiers: barcodes.map((barcode) => ({ kind: "barcode", value: barcode, published: barcode }))
    },
    operators: brands.map((name) => ({ role: "brand", name: knownValue(name, name, seed, "product.brands"), evidence: null })),
    geography: {
      originCountry: originValue,
      notifyingCountry: notifyingValue,
      affectedTerritories: missingValue(),
      distribution: missingValue()
    },
    risk: {
      type: riskKeys.length ? knownValue(riskKeys, hazardLabels, seed, "risk.riskType") : missingValue(),
      hazard: hazardValue,
      description: textValue(riskVersion?.riskDescription, riskVersion?.riskDescription, seed, "risk.versions[0].riskDescription"),
      reason: missingValue(),
      measures: measurePublished.length ? knownValue(measurePublished, measures2, seed, "measureTaken.measures") : missingValue(),
      recommendations: missingValue(),
      priority: derivedValue(priority, seed, "priority")
    },
    resources: [
      { kind: "official_page", url: officialUrl2, label: "Fuente oficial" },
      ...allPhotos.map((photo) => ({ kind: "image", url: photo.url, label: null })),
      ...(detail3?.measureTaken?.companyRecalls ?? []).flatMap((recall) => {
        try {
          const url = new URL(recall.link ?? "");
          return url.protocol === "https:" ? [{ kind: "other", url: url.href, label: "Aviso de retirada de la empresa" }] : [];
        } catch {
          return [];
        }
      }).sort((left, right) => left.url.localeCompare(right.url))
    ],
    sourceRecord: { summary: item.sourceRecord ?? item, detail: detail3?.rawXml ?? detail3 }
  };
  const contentHash = await safetyGateContentHash(canonical);
  return {
    id,
    reference,
    source: "SAFETY GATE",
    type: "No alimentaria",
    priority,
    title,
    product: productPresentation,
    brand,
    productClass: categoryValue.normalized ?? "No alimentaci\xF3n",
    productKey: "",
    brandKey: "",
    provider: "",
    providerKey: "",
    providerRole: "",
    providerEvidence: "",
    hazard,
    origin: origin || "No indicado",
    scope: notifyingCountry ? `Notificado por ${notifyingCountry}` : "Safety Gate \xB7 Uni\xF3n Europea",
    action: measures2.length ? measures2.join(" \xB7 ") : "Consultar las medidas adoptadas en la ficha oficial",
    lots,
    imageUrl,
    url: officialUrl2,
    publishedAt: item.publicationDate || null,
    detectedAt,
    updatedAt: officialUpdate ? modificationDate || item.publicationDate : item.publicationDate || modificationDate,
    contentHash,
    versionCount: 1,
    isUpdate: officialUpdate,
    canonical
  };
}
function parseSafetyGateWeeklyReportIndex(xml) {
  const parsed = xmlParser2.parse(xml);
  const reports = collectObjects(parsed, "weeklyReport").flatMap((record7) => {
    const url = parseOfficialUrl(firstField(record7, ["URL", "url"]));
    const reference = firstField(record7, ["reference", "reportNumber"]);
    const publicationDate = firstField(record7, ["publicationDate", "publishedDate"]);
    if (!url || !url.includes("/api/download/weeklyReport/detail/xml/") || !reference) return [];
    const year = Number(firstField(record7, ["year"]));
    const week = Number(firstField(record7, ["week"]));
    return [{ reference, publicationDate, year: Number.isFinite(year) ? year : null, week: Number.isFinite(week) ? week : null, url }];
  });
  const unique = [...new Map(reports.map((report) => [report.url, report])).values()];
  return unique.sort((a, b) => {
    const dateOrder = parseDate(a.publicationDate).localeCompare(parseDate(b.publicationDate));
    return dateOrder || a.reference.localeCompare(b.reference, "en", { numeric: true });
  });
}
function parseSafetyGateWeeklyReport(xml, report) {
  const parsed = xmlParser2.parse(xml);
  const notifications = collectObjects(parsed, "notifications");
  const records = [];
  let invalidCount = 0;
  for (const raw of notifications) {
    const reference = historicalReference(firstField(raw, ["caseNumber", "alertNumber", "notificationNumber"]));
    const sourceUrl = parseOfficialUrl(firstField(raw, ["reference", "URL", "url"]));
    const id = sourceUrl ? parseAlertId(raw, sourceUrl) : null;
    const product = firstField(raw, ["name", "product", "productName", "description"]);
    if (!reference || id === null || !sourceUrl) {
      invalidCount += 1;
      continue;
    }
    const publicationDate = parseDate(firstField(raw, ["publishedDate", "publicationDate"]) || report.publicationDate);
    const modificationDate = parseDate(firstField(raw, ["modificationDate", "updatedDate"])) || publicationDate;
    const brands = fieldValues(raw, ["brand", "brands"]).map((brand) => ({ brand }));
    const risks = riskEntriesFromPublished(firstField(raw, ["riskType", "risks", "danger"]));
    const imageUrls = nestedFieldValues(raw, ["picture", "photo", "image", "imageUrl"]).map(parseOfficialUrl).filter((url) => Boolean(url));
    const photos = imageUrls.map((url, index2) => ({
      id: Number(url.match(/\/image\/(-?\d+)/)?.[1]) || void 0,
      mainPicture: index2 === 0,
      url
    }));
    const batchNumbers = fieldValues(raw, ["batchNumberBarcode", "batchNumber", "barcode", "productionDates"]).flatMap(splitPublishedList).map((batchNumber) => ({ batchNumber }));
    const measures2 = fieldValues(raw, ["measures", "measuresEconomicOperators"]).flatMap(splitPublishedList).map((name) => ({ measureCategory: { name } }));
    const riskDescription = firstField(raw, ["riskDescription", "danger", "descriptionOfRisk"]);
    const category = firstField(raw, ["category", "productCategory"]);
    const description2 = firstField(raw, ["description", "productDescription", "type_numberOfModel"]);
    const notifyingCountry = firstField(raw, ["notifyingCountry", "country"]);
    const countryOfOrigin = firstField(raw, ["countryOfOrigin", "originCountry"]);
    const item = {
      id,
      reference,
      publicationDate,
      modificationDate,
      officialUrl: sourceUrl,
      product: { name: product, brands, photos },
      risk: { riskType: risks },
      sourceRecord: { report, notification: raw }
    };
    const detail3 = {
      id,
      reference,
      publicationDate,
      modificationDate,
      country: notifyingCountry ? { name: notifyingCountry } : void 0,
      product: {
        productCategory: category ? { name: category } : void 0,
        brands,
        versions: [{ name: product, description: description2 }],
        batchNumbers,
        photos
      },
      risk: { riskType: risks, versions: riskDescription ? [{ riskDescription }] : [] },
      measureTaken: { measures: measures2 },
      traceability: { countryOrigin: countryOfOrigin ? { name: countryOfOrigin } : void 0 },
      rawXml: raw
    };
    records.push({ item, detail: detail3 });
  }
  return { records, invalidCount };
}
async function fetchSafetyGateWeeklyReportIndex(client = {}) {
  const xml = await requestText2(SAFETY_GATE_REPORT_INDEX_ENDPOINT, client);
  const reports = parseSafetyGateWeeklyReportIndex(xml);
  if (!reports.length) throw new SafetyGateRequestError("El \xEDndice XML oficial no contiene informes semanales v\xE1lidos", "invalid-response");
  return reports;
}
async function fetchSafetyGateWeeklyReport(report, client = {}) {
  const xml = await requestText2(report.url, client);
  return parseSafetyGateWeeklyReport(xml, report);
}
async function fetchSafetyGateWeeklyRecentFallback(client = {}, reportCount = 2) {
  const boundedReportCount = Math.max(1, Math.min(4, Math.trunc(reportCount)));
  const reports = (await fetchSafetyGateWeeklyReportIndex(client)).slice(-boundedReportCount);
  if (!reports.length) {
    throw new SafetyGateRequestError("Safety Gate no devolvi\xF3 informes semanales para el fallback reciente", "invalid-response");
  }
  const parsed = await mapLimit2(reports, Math.min(2, reports.length), async (report) => fetchSafetyGateWeeklyReport(report, client));
  const detectedAt = (/* @__PURE__ */ new Date()).toISOString();
  const alertsById = /* @__PURE__ */ new Map();
  let recordsObserved = 0;
  let invalidRecords = 0;
  for (const result of parsed) {
    recordsObserved += result.records.length + result.invalidCount;
    invalidRecords += result.invalidCount;
    const alerts3 = await Promise.all(result.records.map(({ item, detail: detail3 }) => normalizeSafetyGateRecord(item, detail3, detectedAt)));
    for (const alert of alerts3) alertsById.set(alert.id, alert);
  }
  const alerts2 = [...alertsById.values()].sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "") || left.id.localeCompare(right.id));
  const dates = cleanStrings(alerts2.map((alert) => alert.publishedAt));
  return {
    alerts: alerts2,
    reportsScanned: reports.length,
    recordsObserved,
    invalidRecords,
    oldestPublishedAt: dates[0] ?? null,
    newestPublishedAt: dates.at(-1) ?? null
  };
}
var CAROUSEL_PAGE_SIZE = 9;
var CAROUSEL_MAX_PAGES = 200;
var isOfficialIndex404 = (error) => error instanceof SafetyGateRequestError && error.kind === "http" && error.status === 404;
async function fetchSafetyGateCarousel(client, limit) {
  let expectedTotal = null;
  let expectedPages = null;
  const items = [];
  const ids = /* @__PURE__ */ new Set();
  const references = /* @__PURE__ */ new Set();
  let previousDate = Number.POSITIVE_INFINITY;
  let scanned = 0;
  for (let page = 0; page < CAROUSEL_MAX_PAGES; page++) {
    const result = await requestJson4(SAFETY_GATE_CAROUSEL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", language: "es" },
      body: JSON.stringify({ language: "es", page: String(page) })
    }, client);
    const count = result.totalElements;
    const pages = result.totalPages;
    const content = result.content;
    if (!Number.isSafeInteger(count) || !Number.isSafeInteger(pages) || !Number.isSafeInteger(result.size) || result.size !== CAROUSEL_PAGE_SIZE || result.number !== page || count <= 0 || pages <= 0 || pages > CAROUSEL_MAX_PAGES || pages !== Math.ceil(count / CAROUSEL_PAGE_SIZE) || !Array.isArray(content) || page < pages - 1 && (content.length !== CAROUSEL_PAGE_SIZE || result.last !== false) || page === pages - 1 && (content.length !== count - (pages - 1) * CAROUSEL_PAGE_SIZE || result.last !== true) || page >= pages) {
      throw new SafetyGateRequestError("Safety Gate carousel pagination is incomplete or invalid", "pagination");
    }
    if (expectedTotal === null) {
      expectedTotal = count;
      expectedPages = pages;
    }
    if (count !== expectedTotal || pages !== expectedPages) {
      throw new SafetyGateRequestError("Safety Gate carousel collection changed during read", "pagination");
    }
    for (const item of content) {
      const date = Date.parse(item?.publicationDate ?? "");
      if (!Number.isSafeInteger(item?.id) || item.id <= 0 || typeof item.reference !== "string" || !item.reference.trim() || !Number.isFinite(date) || date > previousDate || !item.product || typeof item.product.name !== "string" || !item.risk || ids.has(item.id) || references.has(item.reference)) {
        throw new SafetyGateRequestError("Safety Gate carousel contains an invalid or duplicate official record", "invalid-response");
      }
      ids.add(item.id);
      references.add(item.reference);
      previousDate = date;
      items.push(item);
    }
    scanned++;
    if (limit !== null && items.length >= limit) break;
    if (result.last === true) break;
  }
  if (!items.length || expectedTotal === null || expectedPages === null || limit === null && (scanned !== expectedPages || items.length !== expectedTotal) || limit !== null && items.length < Math.min(limit, expectedTotal)) {
    throw new SafetyGateRequestError("Safety Gate carousel coverage cannot be certified", "pagination");
  }
  const selected = limit === null ? items : items.slice(0, limit);
  return {
    items: selected,
    pagesScanned: scanned,
    recordsObserved: items.length,
    recordsDeduplicated: selected.length,
    totalElements: expectedTotal,
    totalPages: expectedPages
  };
}
async function mapLimit2(items, concurrency, task) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index2 = cursor;
      cursor += 1;
      results[index2] = await task(items[index2]);
    }
  }));
  return results;
}
async function fetchSafetyGateRecentIndex(client = {}, allowCarouselFallback = true) {
  const pages = [];
  const pageSignatures = /* @__PURE__ */ new Set();
  const pageSize = 100;
  const safetyPageLimit = 1e4;
  for (let page = 0; page < safetyPageLimit; page += 1) {
    let response;
    try {
      response = await requestJson4(SAFETY_GATE_RECENT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", language: "es" },
        body: JSON.stringify({ language: "es", page: String(page), pageSize: String(pageSize) })
      }, client);
    } catch (error) {
      if (page !== 0 || !allowCarouselFallback || !isOfficialIndex404(error)) throw error;
      return fetchSafetyGateCarousel(client, null);
    }
    const content = Array.isArray(response.content) ? response.content : [];
    const signature = content.map((item) => `${item.id}:${item.reference}`).join("|");
    if (signature && pageSignatures.has(signature)) {
      throw new SafetyGateRequestError("Safety Gate repiti\xF3 una p\xE1gina y se detuvo para evitar un ciclo", "pagination");
    }
    if (signature) pageSignatures.add(signature);
    pages.push({ ...response, content });
    const totalPages = Number(response.totalPages);
    const atDeclaredEnd = Number.isFinite(totalPages) && totalPages >= 0 && page + 1 >= totalPages;
    if (!content.length || response.last === true || atDeclaredEnd) break;
    if (page + 1 === safetyPageLimit) {
      throw new SafetyGateRequestError(
        `Safety Gate alcanz\xF3 el l\xEDmite de seguridad expl\xEDcito de ${safetyPageLimit} p\xE1ginas`,
        "pagination"
      );
    }
  }
  const observed = pages.flatMap((page) => page.content ?? []);
  if (!observed.length) {
    throw new SafetyGateRequestError("Safety Gate no devolvi\xF3 notificaciones recientes", "invalid-response");
  }
  const byReference = /* @__PURE__ */ new Map();
  for (const item of observed) {
    const current = byReference.get(item.reference);
    if (!current || (item.modificationDate ?? "") >= (current.modificationDate ?? "")) {
      byReference.set(item.reference, item);
    }
  }
  const items = [...byReference.values()];
  return {
    items,
    pagesScanned: pages.length,
    recordsObserved: observed.length,
    recordsDeduplicated: items.length
  };
}
var historicalReference = (value) => value.trim().replace(/(?:\s*<br\s*\/?>)+\s*$/giu, "").trim();
async function hydrateSafetyGateRecentItems(items, client = {}, detectedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  let detailFailures = 0;
  const normalized = await mapLimit2(items, 5, async (item) => {
    try {
      const detail3 = await requestJson4(
        `${SAFETY_GATE_BASE}/public/api/notification/${item.id}?language=es`,
        void 0,
        client
      );
      return await normalizeSafetyGateRecord(item, detail3, detectedAt);
    } catch {
      detailFailures += 1;
      return null;
    }
  });
  const alerts2 = normalized.filter((alert) => Boolean(alert));
  const dates = cleanStrings(alerts2.map((alert) => alert.publishedAt));
  return {
    alerts: alerts2,
    detailFailures,
    oldestPublishedAt: dates[0] ?? null,
    newestPublishedAt: dates.at(-1) ?? null
  };
}
async function fetchSafetyGateRecent(client = {}) {
  const index2 = await fetchSafetyGateRecentIndex(client);
  const hydrated = await hydrateSafetyGateRecentItems(index2.items, client);
  if (!hydrated.alerts.length) {
    throw new SafetyGateRequestError("Safety Gate no devolvi\xF3 detalles verificables", "invalid-response");
  }
  hydrated.alerts.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return {
    alerts: hydrated.alerts,
    pagesScanned: index2.pagesScanned,
    recordsObserved: index2.recordsObserved,
    recordsDeduplicated: index2.recordsDeduplicated,
    detailFailures: hydrated.detailFailures,
    oldestPublishedAt: hydrated.oldestPublishedAt,
    newestPublishedAt: hydrated.newestPublishedAt
  };
}

// candidate-probe-v4-src/lib/safety-gate-discovery.ts
var SafetyGateDiscoveryError = class extends SafetyGateRequestError {
  constructor(discovery, reason) {
    super("Safety Gate recent discovery is not certifiable", "invalid-response", discovery.upstreamStatus);
    this.discovery = discovery;
    this.reason = reason;
    this.name = "SafetyGateDiscoveryError";
  }
};
async function fetchSafetyGateCertifiedRecentIndex(client = {}) {
  const state = {
    method: "primary",
    coverage: "unverified",
    fallbackUsed: false,
    fallbackReason: null,
    totalDeclared: null,
    recordsObserved: 0,
    totalReconstructed: 0,
    unresolvedGap: null,
    failedPage: null,
    upstreamStatus: null,
    upstreamEntityId: null
  };
  const fail5 = (reason) => {
    state.unresolvedGap = state.totalDeclared === null ? null : Math.max(0, state.totalDeclared - state.recordsObserved);
    throw new SafetyGateDiscoveryError({ ...state }, reason);
  };
  const refs = /* @__PURE__ */ new Set();
  const ids = /* @__PURE__ */ new Set();
  let pages = 0;
  let declaredPages = null;
  const fetchImpl = client.fetchImpl ?? fetch;
  const inspectedFetch = async (input, init) => {
    if (String(input) !== SAFETY_GATE_RECENT_ENDPOINT) fail5("unexpected-discovery-endpoint");
    const requested = JSON.parse(String(init?.body ?? "{}"));
    const page = Number(requested.page);
    state.failedPage = page;
    if (!Number.isSafeInteger(page) || page < 0 || page >= 32) fail5("page-budget-exceeded");
    const response = await fetchImpl(input, init);
    state.upstreamStatus = response.status;
    if (!response.ok) {
      const body = await response.clone().text();
      state.upstreamEntityId = body.match(/Unable to find eu\.europa\.ec\.just\.sgrp\.domain\.Product with id (\d{1,20})/u)?.[1] ?? null;
      return response;
    }
    let value;
    try {
      value = await response.clone().json();
    } catch {
      return fail5("invalid-json");
    }
    if (!value || typeof value !== "object" || !Array.isArray(value.content)) fail5("invalid-page");
    const { totalElements, totalPages, size, number: number2, last } = value;
    if (typeof totalElements !== "number" || !Number.isSafeInteger(totalElements) || totalElements <= 0 || typeof totalPages !== "number" || !Number.isSafeInteger(totalPages) || totalPages <= 0 || totalPages > 32 || size !== 100 || number2 !== page || totalPages !== Math.ceil(totalElements / size)) fail5("invalid-pagination-metadata");
    if (state.totalDeclared !== null && (state.totalDeclared !== totalElements || declaredPages !== totalPages)) fail5("collection-changed");
    state.totalDeclared = totalElements;
    declaredPages = totalPages;
    const expected = Math.min(100, totalElements - page * 100);
    if (expected <= 0 || value.content.length !== expected || last !== (page === totalPages - 1)) fail5("incomplete-page");
    for (const item of value.content) {
      if (!item || !Number.isSafeInteger(item.id) || typeof item.reference !== "string" || !item.reference.trim()) fail5("invalid-identity");
      const reference = item.reference.trim();
      if (refs.has(reference) || ids.has(item.id)) fail5("duplicate-identity");
      refs.add(reference);
      ids.add(item.id);
    }
    pages += 1;
    state.recordsObserved = refs.size;
    return response;
  };
  try {
    const index2 = await fetchSafetyGateRecentIndex({ ...client, fetchImpl: inspectedFetch }, false);
    if (pages !== declaredPages || refs.size !== state.totalDeclared || index2.items.length !== refs.size) fail5("incomplete-collection");
    return {
      ...index2,
      discovery: { ...state, coverage: "complete", unresolvedGap: 0, failedPage: null, upstreamStatus: null }
    };
  } catch (error) {
    if (error instanceof SafetyGateDiscoveryError) throw error;
    if (error instanceof SafetyGateRequestError) return fail5(`upstream-${error.kind}`);
    return fail5("unexpected-discovery-error");
  }
}

// candidate-probe-v4-src/lib/safety-gate-sync.ts
var configuredSafetyGateRecentStrategy = () => globalThis.__NAGAMEALERT_SAFETY_GATE_RECENT_MODE__ === "delta" ? "delta" : "full";
var nowIso5 = (options = {}) => (options.now?.() ?? /* @__PURE__ */ new Date()).toISOString();
var emptyState5 = (mode, now = nowIso5()) => ({
  source: "SAFETY GATE",
  mode,
  status: "idle",
  cursor: 0,
  totalUnits: 0,
  pagesScanned: 0,
  recordsObserved: 0,
  recordsPersisted: 0,
  newCount: 0,
  updatedCount: 0,
  detailFailures: 0,
  pageErrors: 0,
  oldestPublishedAt: null,
  newestPublishedAt: null,
  coverage: "unknown",
  startedAt: null,
  lastSuccessAt: null,
  completedAt: null,
  lastError: null,
  leaseOwnerId: null,
  leaseMode: null,
  leaseExpiresAt: null,
  lastSkippedAt: null,
  lastSkipReason: null,
  lastSkippedOwnerId: null,
  updatedAt: now
});
var requireSyncState2 = (store) => {
  if (!store.readSyncState || !store.writeSyncState || !store.writeSyncStateIfLeaseOwned) {
    throw new Error("AlertStore no dispone de estado de sincronizaci\xF3n con fencing de lease");
  }
  return {
    read: store.readSyncState.bind(store),
    write: store.writeSyncState.bind(store),
    writeIfLeaseOwned: store.writeSyncStateIfLeaseOwned.bind(store)
  };
};
var errorMessage5 = (error) => error instanceof Error ? error.message : "Error de sincronizaci\xF3n no identificado";
async function skippedState2(store, mode, ownerId, active, options, reason = "already-running") {
  const at = nowIso5(options);
  const previous = await store.readSyncState?.("SAFETY GATE", mode) ?? emptyState5(mode, at);
  await store.recordSyncSkip?.("SAFETY GATE", mode, ownerId, at, reason);
  return {
    ...previous,
    status: "skipped",
    leaseOwnerId: active?.ownerId ?? null,
    leaseMode: active?.mode ?? null,
    leaseExpiresAt: active?.expiresAt ?? null,
    lastSkippedAt: at,
    lastSkipReason: reason,
    lastSkippedOwnerId: ownerId,
    updatedAt: at
  };
}
async function runWithHeartbeat(client, lease, running, writeIfOwned, task) {
  const ttl = Date.parse(lease.lease.expiresAt) - Date.parse(lease.lease.heartbeatAt);
  const interval = Math.min(6e4, ttl / 3);
  const abort = new AbortController();
  const fetchImpl = client.fetchImpl ?? fetch;
  let heartbeatError;
  let inFlight;
  let rejectHeartbeat;
  const heartbeatFailed = new Promise((_, reject) => {
    rejectHeartbeat = reject;
  });
  const timer = setInterval(() => {
    if (inFlight || heartbeatError) return;
    inFlight = (async () => {
      const renewed = await lease.renew();
      running.leaseExpiresAt = renewed.expiresAt;
      running.updatedAt = renewed.heartbeatAt;
      await writeIfOwned({ ...running });
    })().catch((error) => {
      heartbeatError = error instanceof SyncLeaseLostError ? error : new SyncLeaseLostError();
      if (heartbeatError !== error) heartbeatError.cause = error;
      abort.abort(heartbeatError);
      rejectHeartbeat(heartbeatError);
    }).finally(() => {
      inFlight = void 0;
    });
  }, interval);
  const stop = async () => {
    clearInterval(timer);
    await inFlight;
    abort.abort();
  };
  try {
    const guardedClient = { ...client, fetchImpl: (input, init) => {
      abort.signal.throwIfAborted();
      return fetchImpl(input, {
        ...init,
        signal: AbortSignal.any([abort.signal, ...init?.signal ? [init.signal] : []])
      });
    } };
    const fetched = await Promise.race([
      task(guardedClient),
      heartbeatFailed
    ]);
    await stop();
    if (heartbeatError) throw heartbeatError;
    return fetched;
  } catch (error) {
    await stop();
    throw heartbeatError ?? error;
  }
}
var indexDateRange = (items) => {
  const dates = items.map((item) => item.publicationDate?.trim()).filter(Boolean).sort();
  return { oldestPublishedAt: dates[0] ?? null, newestPublishedAt: dates.at(-1) ?? null };
};
async function fetchSafetyGateDeltaRecent(store, client) {
  if (!store.readAlertsByReferences) {
    throw new Error("AlertStore no soporta selecci\xF3n delta Safety Gate");
  }
  const index2 = await fetchSafetyGateCertifiedRecentIndex(client);
  const stored = await store.readAlertsByReferences("SAFETY GATE", index2.items.map((item) => item.reference));
  const selection = selectSafetyGateDetailCandidates(index2.items, stored);
  const hydrated = await hydrateSafetyGateRecentItems(selection.candidates, client);
  if (hydrated.detailFailures !== 0 || hydrated.alerts.length !== selection.candidates.length) {
    throw new SafetyGateRequestError(
      `Safety Gate delta no pudo hidratar todos los candidatos (${hydrated.alerts.length}/${selection.candidates.length})`,
      "invalid-response"
    );
  }
  const range = indexDateRange(index2.items);
  console.log("SAFETY_GATE_DELTA_RECENT " + JSON.stringify({
    zeroWrite: false,
    recordsObserved: index2.recordsObserved,
    recordsDeduplicated: index2.recordsDeduplicated,
    storedMatched: stored.length,
    candidateCount: selection.candidates.length,
    skippedCount: selection.skipped.length,
    detailRequests: selection.candidates.length,
    reasons: selection.reasons
  }));
  return {
    alerts: hydrated.alerts,
    pagesScanned: index2.pagesScanned,
    recordsObserved: index2.recordsObserved,
    recordsDeduplicated: index2.recordsDeduplicated,
    detailFailures: 0,
    ...range
  };
}
async function recoverRecentWithWeeklyFallback(store, client, lease, running, writeIfOwned, options, primaryError) {
  if (!store.readAlertsByReferences) {
    throw new Error("AlertStore no permite preservar registros existentes durante el fallback semanal");
  }
  let renewed = await lease.renew();
  running.leaseExpiresAt = renewed.expiresAt;
  running.updatedAt = renewed.heartbeatAt;
  await writeIfOwned({ ...running });
  const fallback = await fetchSafetyGateWeeklyRecentFallback(client, 2);
  const references = [...new Set(fallback.alerts.map((alert) => alert.reference))];
  const existing = references.length ? await store.readAlertsByReferences("SAFETY GATE", references) : [];
  const existingReferences = new Set(existing.map((alert) => alert.reference));
  const newAlerts = fallback.alerts.filter((alert) => !existingReferences.has(alert.reference));
  const persisted = newAlerts.length ? await store.persistSuccess("SAFETY GATE", newAlerts) : { newCount: 0, updatedCount: 0 };
  renewed = await lease.renew();
  running.leaseExpiresAt = renewed.expiresAt;
  running.updatedAt = renewed.heartbeatAt;
  await writeIfOwned({ ...running });
  const completedAt = nowIso5(options);
  const state = {
    ...running,
    status: "partial",
    cursor: fallback.reportsScanned,
    totalUnits: fallback.reportsScanned,
    pagesScanned: fallback.reportsScanned,
    recordsObserved: fallback.recordsObserved,
    recordsPersisted: (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
    newCount: persisted.newCount ?? 0,
    updatedCount: persisted.updatedCount ?? 0,
    detailFailures: fallback.invalidRecords,
    pageErrors: running.pageErrors + 1,
    oldestPublishedAt: fallback.oldestPublishedAt,
    newestPublishedAt: fallback.newestPublishedAt,
    coverage: "partial",
    lastSuccessAt: completedAt,
    completedAt,
    lastError: [
      `\xCDndice reciente Safety Gate no disponible: ${errorMessage5(primaryError)}.`,
      `Fallback XML semanal oficial: ${fallback.reportsScanned} informes, ${newAlerts.length} alertas nuevas; registros existentes preservados.`
    ].join(" "),
    leaseOwnerId: null,
    leaseMode: null,
    leaseExpiresAt: null,
    updatedAt: completedAt
  };
  await writeIfOwned(state);
  return state;
}
async function runSafetyGateRecentSync(store, client = {}, options = {}) {
  const sync = requireSyncState2(store);
  const lease = await acquireSourceLease(store, "SAFETY GATE", "recent", options);
  if (!lease.acquired) return skippedState2(store, "recent", lease.ownerId, lease.lease, options);
  try {
    const backfill = await store.findSafetyGateSnapshot?.(["backfill-running"]);
    if (backfill) {
      const state = await skippedState2(store, "recent", lease.ownerId, null, options, "backfill-active");
      await lease.release();
      return state;
    }
  } catch (error) {
    await lease.release();
    throw error;
  }
  const startedAt = nowIso5(options);
  const previous = await sync.read("SAFETY GATE", "recent") ?? emptyState5("recent", startedAt);
  const running = {
    ...previous,
    status: "running",
    cursor: 0,
    totalUnits: 0,
    pagesScanned: 0,
    recordsObserved: 0,
    recordsPersisted: 0,
    newCount: 0,
    updatedCount: 0,
    detailFailures: 0,
    pageErrors: 0,
    oldestPublishedAt: null,
    newestPublishedAt: null,
    coverage: "partial",
    startedAt,
    completedAt: null,
    lastError: null,
    leaseOwnerId: lease.ownerId,
    leaseMode: "recent",
    leaseExpiresAt: lease.lease.expiresAt,
    updatedAt: startedAt
  };
  const writeIfOwned = async (state) => {
    const written = await sync.writeIfLeaseOwned(state, lease.ownerId, nowIso5(options));
    if (!written) throw new SyncLeaseLostError();
  };
  try {
    await writeIfOwned(running);
    let fetched;
    const recentStrategy = options.recentStrategy ?? configuredSafetyGateRecentStrategy();
    try {
      fetched = await runWithHeartbeat(client, lease, running, writeIfOwned, (guardedClient) => recentStrategy === "delta" ? fetchSafetyGateDeltaRecent(store, guardedClient) : fetchSafetyGateRecent(guardedClient));
    } catch (primaryError) {
      const weeklyFallbackEligible = primaryError instanceof SafetyGateRequestError && (primaryError.kind === "http" && primaryError.status === 404 || primaryError instanceof SafetyGateDiscoveryError && primaryError.discovery.upstreamStatus === 404);
      if (!weeklyFallbackEligible) throw primaryError;
      try {
        return await recoverRecentWithWeeklyFallback(
          store,
          client,
          lease,
          running,
          writeIfOwned,
          options,
          primaryError
        );
      } catch (fallbackError) {
        if (fallbackError instanceof SyncLeaseLostError) throw fallbackError;
        const combined = new Error(
          `Safety Gate recent fall\xF3 (${errorMessage5(primaryError)}) y el fallback XML semanal tambi\xE9n fall\xF3 (${errorMessage5(fallbackError)})`
        );
        combined.cause = primaryError;
        throw combined;
      }
    }
    const renewed = await lease.renew();
    running.leaseExpiresAt = renewed.expiresAt;
    running.updatedAt = renewed.heartbeatAt;
    await writeIfOwned(running);
    const persisted = await store.persistSuccess("SAFETY GATE", fetched.alerts, { ownerId: lease.ownerId, now: () => nowIso5(options) });
    await lease.renew();
    const completedAt = nowIso5(options);
    const state = {
      ...running,
      status: fetched.detailFailures ? "partial" : "completed",
      cursor: fetched.pagesScanned,
      totalUnits: fetched.pagesScanned,
      pagesScanned: fetched.pagesScanned,
      recordsObserved: fetched.recordsObserved,
      recordsPersisted: (persisted.newCount ?? 0) + (persisted.updatedCount ?? 0),
      newCount: persisted.newCount ?? 0,
      updatedCount: persisted.updatedCount ?? 0,
      detailFailures: fetched.detailFailures,
      oldestPublishedAt: fetched.oldestPublishedAt,
      newestPublishedAt: fetched.newestPublishedAt,
      lastSuccessAt: completedAt,
      completedAt,
      leaseOwnerId: null,
      leaseMode: null,
      leaseExpiresAt: null,
      updatedAt: completedAt
    };
    await writeIfOwned(state);
    return state;
  } catch (error) {
    const failedAt = nowIso5(options);
    const state = {
      ...running,
      status: "failed",
      pageErrors: 1,
      lastError: errorMessage5(error),
      leaseOwnerId: null,
      leaseMode: null,
      leaseExpiresAt: null,
      updatedAt: failedAt
    };
    if (!(error instanceof SyncLeaseLostError)) {
      let written = false;
      try {
        written = await sync.writeIfLeaseOwned(state, lease.ownerId, nowIso5(options));
      } catch {
      }
      if (written) {
        try {
          await store.persistFailure("SAFETY GATE", error, { ownerId: lease.ownerId, now: () => nowIso5(options) });
        } catch {
        }
      }
    }
    return state;
  } finally {
    await lease.release();
  }
}

// candidate-probe-v4-src/lib/source-reliability-policy.ts
var policy = (value) => Object.freeze({
  ...value,
  recent: Object.freeze({ ...value.recent }),
  revision: Object.freeze({
    ...value.revision,
    ...value.revision.components ? {
      components: Object.freeze(value.revision.components.map((component) => Object.freeze({ ...component })))
    } : {}
  })
});
var SOURCE_RELIABILITY_POLICIES = Object.freeze({
  AESAN: policy({
    source: "AESAN",
    recent: { freshMaxAgeMinutes: 45, staleMaxAgeMinutes: 60 },
    revision: {
      required: true,
      mode: "historical-reconcile",
      scope: "full-archive",
      maxAgeMinutes: 1440,
      certification: "optional"
    }
  }),
  RAPNA: policy({
    source: "RAPNA",
    recent: { freshMaxAgeMinutes: 45, staleMaxAgeMinutes: 60 },
    revision: {
      required: true,
      mode: "current-parity",
      scope: "current+legacy",
      maxAgeMinutes: 1440,
      certification: "required",
      components: [
        { mode: "current-parity", scope: "current", certification: "required" },
        { mode: "legacy-reconcile", scope: "full-archive", certification: "required" }
      ]
    }
  }),
  RASFF: policy({
    source: "RASFF",
    recent: { freshMaxAgeMinutes: 45, staleMaxAgeMinutes: 60 },
    revision: {
      required: true,
      mode: "reconcile",
      scope: "operational-2020+",
      maxAgeMinutes: 360,
      certification: "optional"
    }
  }),
  "SAFETY GATE": policy({
    source: "SAFETY GATE",
    recent: { freshMaxAgeMinutes: 45, staleMaxAgeMinutes: 60 },
    revision: {
      required: false,
      mode: null,
      scope: "recent-index-only",
      maxAgeMinutes: null,
      certification: "not-applicable"
    }
  }),
  OECD: policy({
    source: "OECD",
    recent: { freshMaxAgeMinutes: 45, staleMaxAgeMinutes: 60 },
    revision: {
      required: true,
      mode: "historical-reconcile",
      scope: "operational-2020+",
      maxAgeMinutes: 1440,
      certification: "required"
    }
  })
});
var sourceReliabilityPolicy = (source) => SOURCE_RELIABILITY_POLICIES[source];

// candidate-probe-v4-src/lib/source-revision-certification.ts
var REQUIRED_ZERO_INTEGRITY = Object.freeze({
  AESAN: [
    "duplicateReferenceGroups",
    "missingSourceIdentities",
    "emptyCanonicalRows",
    "canonicalIdentityMismatches",
    "invalidOfficialUrls",
    "invalidContentHashes",
    "invalidVersionHashes",
    "versionCountMismatches"
  ],
  RAPNA: ["duplicateReferenceGroups", "invalidIdentities", "emptyCanonicalRows", "invalidOfficialUrls"],
  RASFF: [
    "duplicateReferenceGroups",
    "duplicateNotifIdGroups",
    "invalidIdentities",
    "missingOrInvalidSourceIdentities",
    "emptyCanonicalRows",
    "canonicalIdentityMismatches",
    "invalidOfficialUrls",
    "invalidContentHashes",
    "invalidVersionHashes",
    "versionCountMismatches",
    "cutoffViolations",
    "missingPublishedAt"
  ],
  OECD: ["duplicateReferenceGroups", "invalidIdentities", "emptyCanonicalRows", "invalidOfficialUrls"]
});
var COUNT_PARITY = Object.freeze({
  AESAN: [
    ["aesanAlerts", "aesanUniqueReferences"],
    ["aesanAlerts", "aesanSourceIdentities"],
    ["aesanVersions", "aesanVersionCountSum"]
  ],
  RAPNA: [
    ["rapnaAlerts", "rapnaUniqueReferences"],
    ["rapnaVersions", "rapnaVersionCountSum"]
  ],
  RASFF: [
    ["rasffAlerts", "rasffUniqueReferences"],
    ["rasffAlerts", "rasffSourceIdentities"],
    ["rasffVersions", "rasffVersionCountSum"]
  ],
  OECD: [
    ["oecdAlerts", "oecdUniqueReferences"],
    ["oecdVersions", "oecdVersionCountSum"]
  ]
});
var safeCount = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} no es un entero seguro no negativo`);
  }
  return value;
};
var iso = (value, label) => {
  if (typeof value !== "string" || !value || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} no es una fecha v\xE1lida`);
  }
  return value;
};
var revisionModeFor = (source) => {
  const mode = sourceReliabilityPolicy(source).revision.mode;
  if (mode !== "historical-reconcile" && mode !== "current-parity" && mode !== "reconcile") {
    throw new Error(`${source} no tiene una revisi\xF3n certificable configurada`);
  }
  return mode;
};
var cycleIdFor = (state) => {
  const explicit = typeof state.planVersion === "string" ? state.planVersion.trim() : "";
  if (explicit) return explicit;
  const completedAt = iso(state.completedAt, "state.completedAt");
  return `${state.source}:${state.mode}:${completedAt}`;
};
var auditObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} no es un objeto v\xE1lido`);
  return value;
};
function buildSourceRevisionCertification(source, state, audit, updatedAt = audit.checkedAt) {
  const policy2 = sourceReliabilityPolicy(source);
  const mode = revisionModeFor(source);
  if (state.source !== source || state.mode !== mode || state.status !== "completed" || state.coverage !== "official-index-complete" || state.lastError !== null) {
    throw new Error(`El ciclo ${source} no es certificable`);
  }
  if (state.detailFailures !== 0) {
    throw new Error(`El ciclo ${source} no es certificable con detailFailures=${state.detailFailures}`);
  }
  const totalUnits = safeCount(state.totalUnits, "state.totalUnits");
  const cursor = safeCount(state.cursor, "state.cursor");
  const recordsObserved = safeCount(state.recordsObserved, "state.recordsObserved");
  if (totalUnits === 0 || recordsObserved === 0) throw new Error(`${source} no tiene cobertura terminal verificable`);
  if ((source === "AESAN" || source === "RAPNA" || source === "OECD") && cursor !== totalUnits) {
    throw new Error(`${source} no tiene cursor terminal completo`);
  }
  const completedAt = iso(state.completedAt, "state.completedAt");
  const auditCheckedAt = iso(audit.checkedAt, "audit.checkedAt");
  if (Date.parse(auditCheckedAt) < Date.parse(completedAt)) {
    throw new Error(`La auditor\xEDa ${source} precede a la finalizaci\xF3n del ciclo`);
  }
  const counts = auditObject(audit.counts, "audit.counts");
  const integrity = auditObject(audit.integrity, "audit.integrity");
  for (const key of REQUIRED_ZERO_INTEGRITY[source]) {
    const value = safeCount(integrity[key], `audit.integrity.${key}`);
    if (value !== 0) throw new Error(`La auditor\xEDa ${source} no supera ${key}`);
  }
  for (const [left, right] of COUNT_PARITY[source]) {
    const leftValue = safeCount(counts[left], `audit.counts.${left}`);
    const rightValue = safeCount(counts[right], `audit.counts.${right}`);
    if (leftValue !== rightValue) {
      throw new Error(`La auditor\xEDa ${source} no conserva paridad ${left}=${leftValue} / ${right}=${rightValue}`);
    }
  }
  const component = policy2.revision.components?.find((entry) => entry.mode === mode) ?? null;
  const certificationScope = component?.scope ?? policy2.revision.scope;
  const certificationPolicy = component?.certification ?? policy2.revision.certification;
  const cycleId = cycleIdFor(state);
  const at = iso(updatedAt, "updatedAt");
  return {
    source,
    mode,
    cycleId,
    completedAt,
    totalUnits,
    recordsObserved,
    coverage: "official-index-complete",
    auditStatus: "passed",
    auditCheckedAt,
    evidence: {
      schemaVersion: 2,
      scope: certificationScope,
      certificationPolicy,
      audit: { checkedAt: auditCheckedAt, counts, integrity },
      state: {
        cycleId,
        cursor,
        totalUnits,
        recordsObserved,
        pagesScanned: safeCount(state.pagesScanned, "state.pagesScanned"),
        recordsPersisted: safeCount(state.recordsPersisted, "state.recordsPersisted"),
        newCount: safeCount(state.newCount, "state.newCount"),
        updatedCount: safeCount(state.updatedCount, "state.updatedCount"),
        pageErrors: safeCount(state.pageErrors, "state.pageErrors"),
        detailFailures: safeCount(state.detailFailures, "state.detailFailures"),
        oldestPublishedAt: state.oldestPublishedAt,
        newestPublishedAt: state.newestPublishedAt
      }
    },
    updatedAt: at
  };
}
async function ensureSourceRevisionCertification(store, source, state, audit) {
  if (!state || state.status !== "completed" || state.coverage !== "official-index-complete" || state.lastError !== null || state.detailFailures !== 0) return null;
  const mode = revisionModeFor(source);
  const cycleId = cycleIdFor(state);
  const existing = await store.readRevisionCertification?.(source, mode) ?? null;
  if (existing && existing.cycleId === cycleId && existing.completedAt === state.completedAt) return existing;
  if (!store.writeRevisionCertification) throw new Error("AlertStore no soporta certificaciones de revisi\xF3n");
  const certification = buildSourceRevisionCertification(source, state, await audit());
  await store.writeRevisionCertification(certification);
  return certification;
}

// candidate-probe-v4-src/lib/oecd-revision-certification.ts
var revisionAudit = (audit) => audit;
async function ensureOecdRevisionCertification(store, state, audit) {
  return ensureSourceRevisionCertification(store, "OECD", state, async () => revisionAudit(await audit()));
}

// candidate-probe-v4-src/lib/rapna-legacy-certification.ts
var safeCount2 = (value, label) => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`${label} no es un entero seguro no negativo`);
  return Number(value);
};
var iso2 = (value, label) => {
  if (typeof value !== "string" || !value || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} no es una fecha v\xE1lida`);
  }
  return value;
};
async function auditRapnaLegacyOfficialCoverage(store, client = {}, now = /* @__PURE__ */ new Date()) {
  if (!store.readAlertsByReferences || !store.readRapnaReferencesByArchive) {
    throw new Error("AlertStore no soporta la auditor\xEDa exacta RAPNA LEGACY");
  }
  const plan = await fetchRapnaLegacyRevisionPlan(client);
  if (!plan.length || plan.some((unit) => unit.archive !== "legacy")) {
    throw new Error("El plan de auditor\xEDa RAPNA LEGACY no es v\xE1lido");
  }
  let rawRowsObserved = 0;
  let pagesScanned = 0;
  const referenceOccurrences = /* @__PURE__ */ new Map();
  const duplicateGroupReferences = /* @__PURE__ */ new Set();
  const referenceClasses = /* @__PURE__ */ new Map();
  const operationalDuplicateReferences = /* @__PURE__ */ new Set();
  const operationalReferences = /* @__PURE__ */ new Set();
  const archiveReferences = /* @__PURE__ */ new Set();
  const undeterminedReferences = /* @__PURE__ */ new Set();
  const fingerprintRows = [];
  for (const unit of plan) {
    const fetched = await fetchRapnaBackfillUnit(unit, client, now.toISOString());
    if (fetched.invalidRecords || fetched.alerts.some((alert) => alert.canonical.sourceRecord.archive !== "legacy")) {
      throw new Error(`La auditor\xEDa RAPNA LEGACY no pudo normalizar completamente ${unit.year}`);
    }
    if (fetched.alerts.length + fetched.duplicateRecords !== fetched.recordsObserved) {
      throw new Error(`La auditor\xEDa RAPNA LEGACY no conserva contabilidad raw/\xFAnica en ${unit.year}`);
    }
    rawRowsObserved += fetched.recordsObserved;
    pagesScanned += fetched.pagesScanned;
    const duplicateReferences = new Set(fetched.duplicateReferences);
    for (const reference of duplicateReferences) duplicateGroupReferences.add(reference);
    for (const alert of fetched.alerts) {
      const retention = classifyOperationalCoverage(alert);
      referenceOccurrences.set(alert.reference, (referenceOccurrences.get(alert.reference) ?? 0) + 1);
      const classes = referenceClasses.get(alert.reference) ?? /* @__PURE__ */ new Set();
      classes.add(retention);
      referenceClasses.set(alert.reference, classes);
      if (retention === "operational") operationalReferences.add(alert.reference);
      else if (retention === "archive") archiveReferences.add(alert.reference);
      else undeterminedReferences.add(alert.reference);
      if (duplicateReferences.has(alert.reference) && retention !== "archive") {
        operationalDuplicateReferences.add(alert.reference);
      }
      fingerprintRows.push({ year: unit.year, reference: alert.reference, contentHash: alert.contentHash, retention });
    }
  }
  for (const [reference, count] of referenceOccurrences) {
    if (count <= 1) continue;
    duplicateGroupReferences.add(reference);
    const classes = referenceClasses.get(reference) ?? /* @__PURE__ */ new Set();
    if (classes.has("operational") || classes.has("undetermined")) operationalDuplicateReferences.add(reference);
  }
  const [d1CurrentList, d1LegacyList] = await Promise.all([
    store.readRapnaReferencesByArchive("current"),
    store.readRapnaReferencesByArchive("legacy")
  ]);
  const d1Current = new Set(d1CurrentList);
  const d1Legacy = new Set(d1LegacyList);
  const officialReferences = new Set(referenceOccurrences.keys());
  const currentOverlapReferences = [...officialReferences].filter((reference) => d1Current.has(reference)).sort((left, right) => left.localeCompare(right, "es", { numeric: true }));
  const missingOperationalReferences = [...operationalReferences].filter((reference) => !d1Legacy.has(reference)).sort((left, right) => left.localeCompare(right, "es", { numeric: true }));
  const unexpectedOperationalReferences = [...d1Legacy].filter((reference) => !operationalReferences.has(reference)).sort((left, right) => left.localeCompare(right, "es", { numeric: true }));
  const storedOperational = await store.readAlertsByReferences("RAPNA", [...operationalReferences]);
  const storedByReference = new Map(storedOperational.filter((alert) => alert.canonical.sourceRecord.archive === "legacy").map((alert) => [alert.reference, alert]));
  const officialOperationalHashes = new Map(
    fingerprintRows.filter((row) => row.retention === "operational").map((row) => [row.reference, row.contentHash])
  );
  const contentMismatchReferences = [...officialOperationalHashes].flatMap(([reference, contentHash]) => {
    const stored = storedByReference.get(reference);
    return stored && stored.contentHash === contentHash ? [] : [reference];
  }).sort((left, right) => left.localeCompare(right, "es", { numeric: true }));
  const duplicateRows = rawRowsObserved - officialReferences.size;
  const duplicateGroups = duplicateGroupReferences.size;
  return {
    checkedAt: now.toISOString(),
    totalUnits: plan.length,
    pagesScanned,
    rawRowsObserved,
    uniqueOfficialReferences: officialReferences.size,
    duplicateRows,
    duplicateGroups,
    operationalReferences: operationalReferences.size,
    archiveReferences: archiveReferences.size,
    undeterminedReferences: undeterminedReferences.size,
    operationalDuplicateReferences: [...operationalDuplicateReferences].sort((left, right) => left.localeCompare(right, "es", { numeric: true })),
    currentOverlapReferences,
    missingOperationalReferences,
    unexpectedOperationalReferences,
    contentMismatchReferences,
    d1CurrentReferences: d1Current.size,
    d1LegacyReferences: d1Legacy.size,
    sourceFingerprint: await sha256(fingerprintRows.sort((left, right) => left.reference.localeCompare(right.reference, "es", { numeric: true }) || left.year - right.year)),
    planFingerprint: await sha256(plan)
  };
}
function buildRapnaLegacyRevisionCertification(state, audit, official, updatedAt = official.checkedAt) {
  if (state.source !== "RAPNA" || state.mode !== "legacy-reconcile" || state.status !== "completed" || state.coverage !== "official-index-complete" || state.lastError !== null || state.detailFailures !== 0 || state.pageErrors !== 0) {
    throw new Error("El ciclo RAPNA LEGACY no es certificable");
  }
  const totalUnits = safeCount2(state.totalUnits, "state.totalUnits");
  const cursor = safeCount2(state.cursor, "state.cursor");
  const recordsObserved = safeCount2(state.recordsObserved, "state.recordsObserved");
  if (!totalUnits || !recordsObserved || cursor !== totalUnits) {
    throw new Error("RAPNA LEGACY no tiene cobertura terminal verificable");
  }
  const completedAt = iso2(state.completedAt, "state.completedAt");
  const auditCheckedAt = iso2(audit.checkedAt, "audit.checkedAt");
  const officialCheckedAt = iso2(official.checkedAt, "official.checkedAt");
  if (Date.parse(auditCheckedAt) < Date.parse(completedAt) || Date.parse(officialCheckedAt) < Date.parse(completedAt)) {
    throw new Error("La certificaci\xF3n RAPNA LEGACY precede a la finalizaci\xF3n del ciclo");
  }
  for (const key of ["duplicateReferenceGroups", "invalidIdentities", "emptyCanonicalRows", "invalidOfficialUrls"]) {
    if (safeCount2(audit.integrity[key], `audit.integrity.${key}`) !== 0) {
      throw new Error(`La auditor\xEDa RAPNA LEGACY no supera ${key}`);
    }
  }
  if (safeCount2(audit.counts.rapnaAlerts, "audit.counts.rapnaAlerts") !== safeCount2(audit.counts.rapnaUniqueReferences, "audit.counts.rapnaUniqueReferences")) {
    throw new Error("La auditor\xEDa RAPNA LEGACY no conserva referencias \xFAnicas");
  }
  if (safeCount2(audit.counts.rapnaVersions, "audit.counts.rapnaVersions") !== safeCount2(audit.counts.rapnaVersionCountSum, "audit.counts.rapnaVersionCountSum")) {
    throw new Error("La auditor\xEDa RAPNA LEGACY no conserva paridad de versiones");
  }
  const d1Current = safeCount2(audit.counts.rapnaCurrentAlerts, "audit.counts.rapnaCurrentAlerts");
  const d1Legacy = safeCount2(audit.counts.rapnaLegacyAlerts, "audit.counts.rapnaLegacyAlerts");
  if (d1Current + d1Legacy !== safeCount2(audit.counts.rapnaAlerts, "audit.counts.rapnaAlerts")) {
    throw new Error("RAPNA contiene filas sin clasificaci\xF3n CURRENT/LEGACY");
  }
  const statePlanFingerprint = typeof state.planVersion === "string" ? state.planVersion.match(/^rapna-legacy-reconcile-v(?:1|2):\d{4}-\d{2}-\d{2}:([0-9a-f]{64})$/u)?.[1] ?? null : null;
  if (!statePlanFingerprint || official.planFingerprint !== statePlanFingerprint || official.totalUnits !== totalUnits || official.pagesScanned !== state.pagesScanned || official.rawRowsObserved !== recordsObserved) {
    throw new Error("La fuente RAPNA LEGACY cambi\xF3 entre el sweep y la certificaci\xF3n");
  }
  if (official.uniqueOfficialReferences + official.duplicateRows !== official.rawRowsObserved) {
    throw new Error("RAPNA LEGACY no conserva la contabilidad raw/\xFAnica oficial");
  }
  if (official.undeterminedReferences !== 0 || official.operationalDuplicateReferences.length || official.currentOverlapReferences.length || official.missingOperationalReferences.length || official.unexpectedOperationalReferences.length || official.contentMismatchReferences.length) {
    throw new Error("RAPNA LEGACY no conserva paridad exacta fuente\u2192dataset operativo");
  }
  if (official.d1LegacyReferences !== official.operationalReferences || d1Legacy !== official.operationalReferences) {
    throw new Error("RAPNA LEGACY no conserva cardinalidad operativa exacta");
  }
  if (!/^[0-9a-f]{64}$/u.test(official.sourceFingerprint) || !/^[0-9a-f]{64}$/u.test(official.planFingerprint)) {
    throw new Error("RAPNA LEGACY no dispone de fingerprints certificables");
  }
  const cycleId = typeof state.planVersion === "string" && state.planVersion.trim() ? state.planVersion.trim() : `RAPNA:legacy-reconcile:${completedAt}`;
  const at = iso2(updatedAt, "updatedAt");
  return {
    source: "RAPNA",
    mode: "legacy-reconcile",
    cycleId,
    completedAt,
    totalUnits,
    recordsObserved,
    coverage: "official-index-complete",
    auditStatus: "passed",
    auditCheckedAt: officialCheckedAt,
    evidence: {
      schemaVersion: 2,
      scope: "legacy-full-archive",
      retention: {
        operationalFrom: VIGIA_OPERATIONAL_HISTORY_FROM,
        preCutoffRowsExpectedToRemainOutsideHotD1: true
      },
      officialCoverage: official,
      state: {
        cycleId,
        cursor,
        totalUnits,
        rawRowsObserved: recordsObserved,
        pagesScanned: safeCount2(state.pagesScanned, "state.pagesScanned"),
        changedRowsPersisted: safeCount2(state.recordsPersisted, "state.recordsPersisted"),
        newCount: safeCount2(state.newCount, "state.newCount"),
        updatedCount: safeCount2(state.updatedCount, "state.updatedCount"),
        pageErrors: safeCount2(state.pageErrors, "state.pageErrors"),
        detailFailures: safeCount2(state.detailFailures, "state.detailFailures"),
        oldestPublishedAt: state.oldestPublishedAt,
        newestPublishedAt: state.newestPublishedAt
      },
      audit: {
        checkedAt: auditCheckedAt,
        counts: audit.counts,
        integrity: audit.integrity
      }
    },
    updatedAt: at
  };
}
async function ensureRapnaLegacyRevisionCertification(store, state, audit, officialCoverage) {
  if (!state || state.status !== "completed" || state.coverage !== "official-index-complete" || state.lastError !== null || state.detailFailures !== 0 || state.pageErrors !== 0) return null;
  const cycleId = typeof state.planVersion === "string" ? state.planVersion.trim() : "";
  const existing = await store.readRevisionCertification?.("RAPNA", "legacy-reconcile") ?? null;
  if (existing && cycleId && existing.cycleId === cycleId && existing.completedAt === state.completedAt) return existing;
  if (!store.writeRevisionCertification) throw new Error("AlertStore no soporta certificaciones RAPNA LEGACY");
  const [databaseAudit, official] = await Promise.all([audit(), officialCoverage()]);
  const certification = buildRapnaLegacyRevisionCertification(state, databaseAudit, official);
  await store.writeRevisionCertification(certification);
  return certification;
}

// candidate-probe-v4-src/lib/reliability-source-runner.ts
var SOURCE_RUNNER_LIMITS = Object.freeze({ recentMs: 6 * 6e4, revisionMs: 4 * 6e4, recentRequests: 800, revisionRequests: 1600, revisionBatches: 20, revisionReserveMs: 3e4 });
var revisionJobKey = (source, mode) => source + ":" + mode;
var readTime = (value) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
function allowedSourceJob(job, now) {
  const modes = { AESAN: ["historical-reconcile"], RAPNA: ["current-parity", "legacy-reconcile"], RASFF: ["reconcile"], OECD: ["historical-reconcile"], "SAFETY GATE": [] };
  return Boolean(job && Object.hasOwn(modes, job.source) && typeof job.id === "string" && /^[a-f0-9-]{36}$/u.test(job.id) && typeof job.coordinatorOwner === "string" && Number.isSafeInteger(job.epoch) && job.epoch > 0 && Number.isFinite(job.deadline) && job.deadline > now && job.deadline <= now + (job.kind === "recent" ? SOURCE_RUNNER_LIMITS.recentMs : SOURCE_RUNNER_LIMITS.revisionMs) && (!job.pendingDetails || job.source === "RASFF" && Array.isArray(job.pendingDetails) && job.pendingDetails.length <= 40 && job.pendingDetails.every((x) => /^\d{4}\.\d+$/u.test(x.reference) && Number.isSafeInteger(x.notifId) && x.notifId > 0) && new Set(job.pendingDetails.map((x) => x.reference)).size === job.pendingDetails.length) && (job.kind === "recent" ? job.mode === "recent" && Object.hasOwn(modes, job.source) : job.kind === "revision" && modes[job.source]?.includes(job.mode)));
}
async function runFencedSourceJob(store, job, fetchImpl = fetch, clock = Date.now) {
  const startedAt = new Date(clock()).toISOString();
  let batches = 0, uncertain = false, state = null, pendingDetails = job.pendingDetails ?? [];
  let repairing = false, repairNew = 0, repairUpdated = 0;
  const budget = boundedOfficialFetch(job.deadline, job.kind === "recent" ? SOURCE_RUNNER_LIMITS.recentRequests : SOURCE_RUNNER_LIMITS.revisionRequests, fetchImpl, clock);
  const receipt = (outcome, reason) => ({ id: job.id, source: job.source, mode: job.mode, kind: job.kind, startedAt, finishedAt: new Date(clock()).toISOString(), outcome, state, requests: budget.requests(), batches, reason, pendingDetails });
  if (!allowedSourceJob(job, clock())) return receipt("skipped", "invalid-or-expired-job");
  const before = await store.readSyncState?.(job.source, job.mode) ?? null;
  if ((before?.updatedAt ?? null) !== job.beforeUpdatedAt) return receipt("skipped", "source-state-changed-before-claim");
  const lease = await acquireSourceLease(store, job.source, job.mode, { ownerId: job.id, leaseTtlMs: 8 * 6e4, now: () => new Date(clock()) });
  if (!lease.acquired) return receipt("skipped", "source-lease-active");
  try {
    const fence = { ownerId: job.id, now: () => new Date(clock()).toISOString() };
    const owned = {
      ...store,
      releaseSyncLease: async (source, owner) => {
        if (source !== job.source || owner !== job.id) throw new SyncLeaseLostError();
        return true;
      },
      persistSuccess: async (source, alerts2) => {
        budget.assert();
        if (source !== job.source) throw new SyncLeaseLostError();
        try {
          const result = await store.persistSuccess(source, alerts2, fence);
          if (repairing) {
            repairNew += result.newCount ?? 0;
            repairUpdated += result.updatedCount ?? 0;
          }
          return result;
        } catch (error) {
          uncertain = true;
          throw error;
        }
      },
      persistFailure: (source, error) => store.persistFailure(source, error, fence),
      writeSyncState: async (next) => {
        if (next.source !== job.source || next.mode !== job.mode || !store.writeSyncStateIfLeaseOwned || !await store.writeSyncStateIfLeaseOwned(next, job.id, fence.now())) throw new SyncLeaseLostError();
      },
      writeRevisionCertification: async (certificate) => {
        budget.assert();
        if (certificate.source !== job.source || certificate.mode !== job.mode || !store.writeRevisionCertification) throw new SyncLeaseLostError();
        try {
          await store.writeRevisionCertification(certificate, fence);
        } catch (error) {
          uncertain = true;
          throw error;
        }
      }
    };
    const current = await store.readSyncState?.(job.source, job.mode) ?? null;
    if ((current?.updatedAt ?? null) !== job.beforeUpdatedAt) return receipt("skipped", "source-state-changed-after-claim");
    const client = { fetchImpl: budget.fetch, fetch: budget.fetch, retries: 0, detailMaxAttempts: 1, detailConcurrency: 3 }, options = { ownerId: job.id, leaseTtlMs: 8 * 6e4, now: () => new Date(clock()) };
    if (pendingDetails.length) {
      if (job.source !== "RASFF" || !before || before.detailFailures !== pendingDetails.length) return receipt("skipped", "deferred-detail-manifest-mismatch");
      repairing = true;
      batches++;
      const repaired = await repairRasffDetails(owned, pendingDetails, client, startedAt);
      repairing = false;
      const failed = repaired.failed.map(({ reference, notifId }) => ({ reference, notifId }));
      if (repaired.repaired.length + repaired.unchanged.length + failed.length !== pendingDetails.length) return receipt("unknown", "repair-coverage-unconfirmed");
      pendingDetails = failed;
      state = { ...before, status: "partial", detailFailures: failed.length, lastError: failed.length ? "HTTP upstream deferred detail recovery" : null, recordsPersisted: before.recordsPersisted + repairNew + repairUpdated, newCount: before.newCount + repairNew, updatedCount: before.updatedCount + repairUpdated, updatedAt: new Date(clock()).toISOString() };
      await owned.writeSyncState(state);
      if (uncertain) return receipt("unknown", "repair-persistence-outcome-unknown");
      if (failed.length) return receipt("failed", "HTTP upstream deferred detail recovery");
    } else if (job.source === "RASFF" && before?.detailFailures) return receipt("skipped", "deferred-detail-manifest-required");
    if (job.kind === "recent") {
      batches++;
      if (job.source === "AESAN") state = await runAesanFeedSync(owned, { ...options, fetchAlerts: () => fetchNativeAesanAlerts(owned, budget.fetch) });
      else if (job.source === "RAPNA") state = await runRapnaRecentSync(owned, client, options);
      else if (job.source === "RASFF") state = await runRasffRecentSync(owned, client, options);
      else if (job.source === "OECD") state = await runOecdRecentSync(owned, client, options);
      else state = await runSafetyGateRecentSync(owned, client, { ...options, recentStrategy: "full" });
    } else {
      for (let index2 = 0; batches < SOURCE_RUNNER_LIMITS.revisionBatches; index2++) {
        if (clock() + SOURCE_RUNNER_LIMITS.revisionReserveMs >= job.deadline) break;
        const recent = await store.readSyncState?.(job.source, "recent") ?? null, last = readTime(recent?.lastSuccessAt ?? null);
        if (last === null || clock() - last > 25 * 6e4) return receipt(state ? "partial" : "skipped", "recent-priority");
        if (index2 > 0) {
          const persisted2 = await store.readSyncState?.(job.source, job.mode) ?? null;
          if (!state || persisted2?.updatedAt !== state.updatedAt || persisted2.cursor !== state.cursor || persisted2.planVersion !== state.planVersion) return receipt("unknown", "historical-state-changed-no-retry");
        }
        batches++;
        if (job.source === "AESAN") state = await runAesanFeedSync(owned, { ...options, mode: "historical-reconcile", fetchAlerts: () => fetchNativeAesanAlerts(owned, budget.fetch, true) });
        else if (job.source === "RAPNA") state = job.mode === "current-parity" ? await runRapnaCurrentParity(owned, 6, client, options) : await runRapnaLegacyReconcile(owned, 3, client, options);
        else if (job.source === "RASFF") state = await runRasffReconcileSync(owned, 40, client, options);
        else if (job.source === "OECD") state = await runOecdHistoricalReconcileBatch(owned, 12, client, options);
        else throw Error("Safety Gate historical execution prohibited");
        if (job.source === "RASFF") pendingDetails = (state.deferredDetails ?? []).map(({ reference, notifId }) => ({ reference, notifId }));
        if (uncertain) break;
        if (state.lastError || state.status !== "partial" || state.detailFailures) break;
      }
      if (!uncertain && state?.status === "completed" && !state.lastError && !state.detailFailures) {
        if (job.source === "SAFETY GATE") throw Error("Safety Gate historical certification prohibited");
        if (job.source === "OECD") await ensureOecdRevisionCertification(owned, state, auditOecdDatabase);
        else if (job.source === "RAPNA" && job.mode === "legacy-reconcile") await ensureRapnaLegacyRevisionCertification(owned, state, auditRapnaDatabase, () => auditRapnaLegacyOfficialCoverage(owned, client));
        else {
          const audit = job.source === "AESAN" ? auditAesanRevisionDatabase : job.source === "RASFF" ? auditRasffDatabase : auditRapnaDatabase;
          await ensureSourceRevisionCertification(owned, job.source, state, async () => await audit());
        }
      }
    }
    if (job.source === "RASFF" && job.kind === "recent") pendingDetails = (state?.deferredDetails ?? []).map(({ reference, notifId }) => ({ reference, notifId }));
    if (uncertain) return receipt("unknown", "persistence-outcome-unknown-no-retry");
    if (!state) return receipt("skipped", "no-batch-budget");
    const persisted = await store.readSyncState?.(job.source, job.mode) ?? null;
    if (!persisted || persisted.updatedAt !== state.updatedAt || persisted.status !== state.status || persisted.cursor !== state.cursor) return receipt("unknown", "post-source-receipt-mismatch");
    if (state.lastError || state.detailFailures || state.status === "failed") return receipt("failed", state.lastError ?? "incomplete-detail-batch");
    return receipt(state.status === "completed" ? "completed" : state.status === "partial" ? "partial" : "skipped", null);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "source-job-failed";
    if (state?.status === "completed") {
      state = { ...state, status: "failed", lastError: "Revision certification failed: " + reason, updatedAt: new Date(clock()).toISOString() };
      try {
        if (!store.writeSyncStateIfLeaseOwned || !await store.writeSyncStateIfLeaseOwned(state, job.id, new Date(clock()).toISOString())) uncertain = true;
      } catch {
        uncertain = true;
      }
    }
    return receipt(uncertain ? "unknown" : "failed", reason);
  } finally {
    await lease.release();
  }
}

// candidate-probe-v4-src/lib/reliability-job-store.ts
async function readReliabilityReceipt(db, id) {
  const row = await db.prepare("SELECT receipt_json AS receipt FROM source_reliability_jobs WHERE id=?").bind(id).first();
  return row?.receipt ? JSON.parse(row.receipt) : null;
}
async function claimReliabilityJob(db, job, at) {
  await db.prepare(`DELETE FROM source_reliability_jobs WHERE finished_at<?
    AND json_extract(receipt_json,'$.outcome')!='unknown'
    AND id NOT IN (SELECT json_extract(value,'$.id') FROM source_reliability_control,json_each(state_json,'$.attempts')
      UNION SELECT json_extract(value,'$.id') FROM source_reliability_control,json_each(state_json,'$.revisionAttempts'))`).bind(new Date(Date.parse(at) - 14 * 864e5).toISOString()).run();
  const key = job.kind === "recent" ? job.source : revisionJobKey(job.source, job.mode);
  const path = "$." + (job.kind === "recent" ? "attempts" : "revisionAttempts") + "." + JSON.stringify(key) + ".id";
  const row = await db.prepare(`INSERT INTO source_reliability_jobs(id,source,mode,kind,epoch,started_at,deadline)
    SELECT ?,?,?,?,?,?,? FROM source_reliability_control WHERE id=1 AND owner_id=? AND epoch=? AND expires_at>?
    AND json_extract(state_json,?)=? AND COALESCE(json_extract(state_json,?),'[]')=? ON CONFLICT(id) DO NOTHING RETURNING id`).bind(job.id, job.source, job.mode, job.kind, job.epoch, at, job.deadline, job.coordinatorOwner, job.epoch, at, path, job.id, path.replace(/\.id$/u, ".pendingDetails"), JSON.stringify(job.pendingDetails ?? [])).first();
  return Boolean(row);
}
async function finishReliabilityJob(db, receipt) {
  const result = await db.prepare(`UPDATE source_reliability_jobs SET finished_at=?,receipt_json=?
    WHERE id=? AND source=? AND mode=? AND kind=? AND receipt_json IS NULL`).bind(receipt.finishedAt, JSON.stringify(receipt), receipt.id, receipt.source, receipt.mode, receipt.kind).run();
  if (result.meta.changes !== 1) throw Error("job receipt fence lost");
}

// candidate-probe-v4-src/worker/source-runner.ts
var json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
var source_runner_default = {
  async fetch(request2, env) {
    globalThis.__VIGIA_DB__ = env.DB;
    globalThis.__VIGIA_SYNC_TOKEN__ = env.VIGIA_SYNC_TOKEN;
    if (!await isAuthorizedControlPlane(request2)) return json({ outcome: "HOLD", reason: "unauthorized" }, 401);
    const url = new URL(request2.url), store = createD1AlertStore();
    if (request2.method === "GET" && url.pathname === "/status") return json({ component: "source-runner", configVersion: 2, mode: env.SOURCE_RUNNER_MODE ?? null, hasCron: false });
    if (request2.method === "GET" && url.pathname === "/probe" && env.SOURCE_RUNNER_MODE === "probe") {
      const source = url.searchParams.get("source"), budget = boundedOfficialFetch(Date.now() + 36e4, 800), startedAt = (/* @__PURE__ */ new Date()).toISOString();
      try {
        if (source === "AESAN") {
          const previous = await store.readAesanProducerSeed(), alerts2 = await fetchNativeAesanAlerts(store, budget.fetch, url.searchParams.get("full") === "1");
          const prior2 = new Map(previous.map((a) => [a.id, a])), changed = alerts2.filter((a) => prior2.has(a.id) && prior2.get(a.id).contentHash !== a.contentHash), newAlerts = alerts2.filter((a) => !prior2.has(a.id));
          const identityDrift = alerts2.filter((a) => prior2.has(a.id) && prior2.get(a.id).canonical.identity.sourceRecordId !== a.canonical.identity.sourceRecordId);
          return json({ zeroWrite: true, source, startedAt, finishedAt: (/* @__PURE__ */ new Date()).toISOString(), requests: budget.requests(), observed: alerts2.length, previous: previous.length, changedReferences: changed.map((a) => a.reference), newReferences: newAlerts.map((a) => a.reference), identityDrift: identityDrift.map((a) => a.reference), outcome: identityDrift.length ? "HOLD" : "observed" });
        }
        if (source === "SAFETY GATE") {
          const result = await fetchSafetyGateRecent({ fetchImpl: budget.fetch, retries: 0 });
          return json({ zeroWrite: true, source, startedAt, finishedAt: (/* @__PURE__ */ new Date()).toISOString(), requests: budget.requests(), observed: result.recordsObserved, details: result.alerts.length, detailFailures: result.detailFailures, outcome: result.detailFailures ? "HOLD" : "observed" });
        }
        return json({ outcome: "HOLD", reason: "unsupported-probe" }, 400);
      } catch (error) {
        return json({ zeroWrite: true, source, startedAt, finishedAt: (/* @__PURE__ */ new Date()).toISOString(), requests: budget.requests(), outcome: "HOLD", reason: error instanceof Error ? error.message : "probe-failed" }, 503);
      }
    }
    if (request2.method !== "POST" || url.pathname !== "/execute" || env.SOURCE_RUNNER_MODE !== "active") return json({ outcome: "HOLD", reason: "runner-disabled" }, 409);
    if (Number(request2.headers.get("Content-Length") ?? 0) > 4096) return json({ outcome: "HOLD", reason: "oversized-job" }, 400);
    let job;
    try {
      const text4 = await request2.text();
      if (text4.length > 4096) throw Error("oversized");
      job = JSON.parse(text4);
    } catch {
      return json({ outcome: "HOLD", reason: "invalid-job" }, 400);
    }
    if (!allowedSourceJob(job, Date.now())) return json({ outcome: "HOLD", reason: "invalid-or-expired-job" }, 400);
    const prior = await readReliabilityReceipt(env.DB, job.id);
    if (prior) return json(prior);
    if (!await claimReliabilityJob(env.DB, job, (/* @__PURE__ */ new Date()).toISOString())) return json({ outcome: "HOLD", reason: "job-unclaimed-or-running" }, 409);
    const receipt = await runFencedSourceJob(store, job);
    await finishReliabilityJob(env.DB, receipt);
    return json(receipt);
  }
};
export {
  source_runner_default as default
};
