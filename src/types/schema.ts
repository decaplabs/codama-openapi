import { Extensions, Ref } from './document';

// Schema
export type SchemaType = 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string';

// Schema name -> definition, e.g. components.schemas before $ref-wrapping
export type SchemaMap = Record<string, SchemaObject>;

export type SchemaObject = Extensions & {
    description?: string;
    enum?: unknown[];
    format?: string;
    // Arrays
    items?: Ref<SchemaObject>;
    maxItems?: number;
    minItems?: number;
    nullable?: boolean;
    oneOf?: Ref<SchemaObject>[];
    pattern?: string;
    // Objects
    properties?: Record<string, Ref<SchemaObject>>;
    required?: string[];
    // Core
    type?: SchemaType;
};
