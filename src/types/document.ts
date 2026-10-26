// Specification Extensions
import { PathsObject } from './paths';
import { SchemaObject } from './schema';

// Any object may carry extra fields whose names start with "x-".
export type Extensions = {
    [key: `x-${string}`]: unknown;
};

// Reference
export type ReferenceObject = {
    $ref: string;
};

export type Ref<T> = ReferenceObject | T;

export const isReference = (value: unknown): value is ReferenceObject =>
    typeof value === 'object' && value !== null && '$ref' in value;

// Components
export type ComponentsObject = Extensions & {
    schemas?: Record<string, Ref<SchemaObject>>;
};

// Based on the OpenAPI v3.0.3 specification:
// https://spec.openapis.org/oas/v3.0.3.html#openapi-object
export type OpenAPIObject = Extensions & {
    components?: ComponentsObject;
    info: InfoObject;
    openapi: string;
    paths: PathsObject;
    servers?: ServerObject[];
    tags?: TagObject[];
};

export type InfoObject = Extensions & {
    description?: string;
    title: string;
    version: string;
};

export type ServerObject = Extensions & {
    url: string;
};

export type TagObject = Extensions & {
    description?: string;
    name: string;
};
