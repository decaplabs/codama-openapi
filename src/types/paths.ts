import { Extensions, Ref } from './document';
import { SchemaObject } from './schema';

// Paths
export type PathsObject = Extensions & {
    [path: `/${string}`]: PathItemObject;
};

export type PathItemObject = Extensions & {
    $ref?: string;
    get?: OperationObject;
    post?: OperationObject;
};

// Operation
export type OperationObject = Extensions & {
    operationId?: string;
    parameters?: Ref<ParameterObject>[];
    requestBody?: Ref<RequestBodyObject>;
    responses: ResponsesObject;
    summary?: string;
    tags?: string[];
};

// Parameters
export type ParameterLocation = 'cookie' | 'header' | 'path' | 'query';

export type ParameterObject = Extensions & {
    description?: string;
    in: ParameterLocation;
    name: string;
    required?: boolean;
    schema?: Ref<SchemaObject>;
};

// Request Body & Media Types
export type RequestBodyObject = Extensions & {
    content: Record<string, { schema?: Ref<SchemaObject> }>;
    required?: boolean;
};

// Responses
// Keys are "default" or an HTTP status code / range such as "200" or "4XX"
export type ResponsesObject = Extensions & {
    [status: string]: Ref<ResponseObject>;
};

export type ResponseObject = Extensions & {
    content?: Record<string, { schema?: Ref<SchemaObject> }>;
    description: string;
};
