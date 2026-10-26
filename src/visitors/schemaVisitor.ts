import { REGISTERED_TYPE_NODE_KINDS } from '@codama/nodes';
import { extendVisitor, staticVisitor, visit } from '@codama/visitors-core';

import { SchemaObject } from '../types';
import { pascal } from '../utils';

// Visitor turns one Codama type node into an OpenAPI schema
export function getSchemaVisitor() {
    // Default for any type that is not handled: fail loudly
    const base = staticVisitor<SchemaObject>(
        node => {
            throw new Error(`Unsupported type node "${node.kind}"`);
        },
        { keys: [...REGISTERED_TYPE_NODE_KINDS, 'structFieldTypeNode', 'definedTypeLinkNode'] },
    );

    return extendVisitor(base, {
        visitArrayType(node, { self }) {
            const items = visit(node.item, self);
            return node.count.kind === 'fixedCountNode'
                ? { items, maxItems: node.count.value, minItems: node.count.value, type: 'array' }
                : { items, type: 'array' };
        },
        visitBooleanType: () => ({ type: 'boolean' }),
        visitBytesType: () => ({ format: 'byte', type: 'string' }),
        visitDefinedTypeLink: node => ({ $ref: `#/components/schemas/${pascal(node.name)}` }),
        visitEnumEmptyVariantType: node => ({ enum: [node.name], type: 'string' }),
        visitEnumStructVariantType(node, { self }) {
            return { properties: { [node.name]: visit(node.struct, self) }, required: [node.name], type: 'object' };
        },
        visitEnumTupleVariantType(node, { self }) {
            return { properties: { [node.name]: visit(node.tuple, self) }, required: [node.name], type: 'object' };
        },
        visitEnumType(node, { self }) {
            const variants = node.variants ?? [];
            // C-style enum (no payload on any variant) maps to a plain string enum
            if (variants.every(variant => variant.kind === 'enumEmptyVariantTypeNode')) {
                return { enum: variants.map(variant => variant.name), type: 'string' };
            }
            return { oneOf: variants.map(variant => visit(variant, self)) };
        },
        visitFixedSizeType: (node, { self }) => visit(node.type, self),
        visitNumberType(node) {
            if (['u64', 'u128'].includes(node.format)) return { pattern: '^[0-9]+$', type: 'string' };
            if (['i64', 'i128'].includes(node.format)) return { pattern: '^-?[0-9]+$', type: 'string' };
            // TODO: f32/f64 fall through here and are mistyped as 'integer' instead of 'number'
            return { type: 'integer' };
        },
        visitOptionType(node, { self }) {
            const schema = visit(node.item, self);
            // $refs can't carry `nullable` under OAS 3.0; optionality is already
            // expressed by omitting this field from the struct's `required` list
            return '$ref' in schema ? schema : { ...schema, nullable: true };
        },
        visitPublicKeyType: () => ({ description: 'base58 public key', type: 'string' }),
        visitSizePrefixType: (node, { self }) => visit(node.type, self),
        visitStringType: () => ({ type: 'string' }),
        visitStructType(node, { self }) {
            const properties: Record<string, SchemaObject> = {};
            const required: string[] = [];

            for (const field of node.fields ?? []) {
                if (field.defaultValueStrategy === 'omitted') continue; // discriminator

                properties[field.name] = visit(field.type, self);
                // Option<T> fields may be absent, so they're not required
                if (field.type.kind !== 'optionTypeNode') required.push(field.name);
            }
            return { properties, type: 'object', ...(required.length ? { required } : {}) };
        },

        visitTupleType(node, { self }) {
            const items = (node.items ?? []).map(item => visit(item, self));
            // Dedupe identical slot schemas, for example (u8, u8)
            const unique = [...new Map(items.map(item => [JSON.stringify(item), item])).values()];
            // OAS 3.0 has no positional-tuple validation
            return {
                items: unique.length > 1 ? { oneOf: unique } : unique[0],
                maxItems: items.length,
                minItems: items.length,
                type: 'array',
            };
        },

        visitSolAmountType(node, { self }) {
            return { ...visit(node.number, self), description: 'amount in lamports' };
        },
    });
}
