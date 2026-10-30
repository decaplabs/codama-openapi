import {
    arrayTypeNode,
    booleanTypeNode,
    bytesTypeNode,
    definedTypeLinkNode,
    enumEmptyVariantTypeNode,
    enumStructVariantTypeNode,
    enumTupleVariantTypeNode,
    enumTypeNode,
    fixedCountNode,
    fixedSizeTypeNode,
    numberTypeNode,
    optionTypeNode,
    prefixedCountNode,
    publicKeyTypeNode,
    REGISTERED_TYPE_NODE_KINDS,
    remainderCountNode,
    sizePrefixTypeNode,
    solAmountTypeNode,
    stringTypeNode,
    structFieldTypeNode,
    structTypeNode,
    tupleTypeNode,
} from '@codama/nodes';
import { visit } from '@codama/visitors-core';
import { expect, test } from 'vitest';

import { getSchemaVisitor } from '../../src/visitors';

// Mirrors the patterns in src/visitors/schemaVisitor.ts for u64/u128 and i64/i128.
// Change them here if the renderer's pattern ever changes, instead of in every test case.
const UNSIGNED_BIG_INT_PATTERN = '^[0-9]+$';
const SIGNED_BIG_INT_PATTERN = '^-?[0-9]+$';

// Kinds the visitor explicitly overrides via extendVisitor; everything else registered
// by @codama/nodes falls through to the "fail loudly" default and must throw.
const HANDLED_KINDS = new Set([
    'arrayTypeNode',
    'booleanTypeNode',
    'bytesTypeNode',
    'enumEmptyVariantTypeNode',
    'enumStructVariantTypeNode',
    'enumTupleVariantTypeNode',
    'enumTypeNode',
    'fixedSizeTypeNode',
    'numberTypeNode',
    'optionTypeNode',
    'publicKeyTypeNode',
    'sizePrefixTypeNode',
    'solAmountTypeNode',
    'stringTypeNode',
    'structTypeNode',
    'tupleTypeNode',
]);

const UNHANDLED_KINDS = REGISTERED_TYPE_NODE_KINDS.filter(kind => !HANDLED_KINDS.has(kind));

test('it maps a u64 number type to a string pattern', () => {
    const result = visit(numberTypeNode('u64'), getSchemaVisitor());

    expect(result).toEqual({ pattern: UNSIGNED_BIG_INT_PATTERN, type: 'string' });
});

test('it maps a u128/i128 number type to a string pattern', () => {
    expect(visit(numberTypeNode('u128'), getSchemaVisitor())).toEqual({
        pattern: UNSIGNED_BIG_INT_PATTERN,
        type: 'string',
    });
    expect(visit(numberTypeNode('i64'), getSchemaVisitor())).toEqual({
        pattern: SIGNED_BIG_INT_PATTERN,
        type: 'string',
    });
    expect(visit(numberTypeNode('i128'), getSchemaVisitor())).toEqual({
        pattern: SIGNED_BIG_INT_PATTERN,
        type: 'string',
    });
});

test('it maps small number types to a plain integer', () => {
    expect(visit(numberTypeNode('u8'), getSchemaVisitor())).toEqual({ type: 'integer' });
    expect(visit(numberTypeNode('i32'), getSchemaVisitor())).toEqual({ type: 'integer' });
});

test('it maps f32/f64 number types to a plain number', () => {
    expect(visit(numberTypeNode('f32'), getSchemaVisitor())).toEqual({ format: 'float', type: 'number' });
    expect(visit(numberTypeNode('f64'), getSchemaVisitor())).toEqual({ format: 'double', type: 'number' });
});

test('it maps a boolean type', () => {
    expect(visit(booleanTypeNode(), getSchemaVisitor())).toEqual({ type: 'boolean' });
});

test('it maps a bytes type to a base64 string', () => {
    expect(visit(bytesTypeNode(), getSchemaVisitor())).toEqual({ format: 'byte', type: 'string' });
});

test('it maps a string type', () => {
    expect(visit(stringTypeNode('utf8'), getSchemaVisitor())).toEqual({ type: 'string' });
});

test('it maps a public key type', () => {
    expect(visit(publicKeyTypeNode(), getSchemaVisitor())).toEqual({
        description: 'base58 public key',
        type: 'string',
    });
});

test('it maps a sol amount type to its wrapped number schema, annotated as lamports', () => {
    expect(visit(solAmountTypeNode(numberTypeNode('u64')), getSchemaVisitor())).toEqual({
        description: 'amount in lamports',
        pattern: UNSIGNED_BIG_INT_PATTERN,
        type: 'string',
    });
});

test('it maps a defined type link to a $ref', () => {
    expect(visit(definedTypeLinkNode('feeBps'), getSchemaVisitor())).toEqual({
        $ref: '#/components/schemas/FeeBps',
    });
});

test('it ignores the program on a cross-program defined type link, refing it as if it were local', () => {
    expect(visit(definedTypeLinkNode('feeBps', 'otherProgram'), getSchemaVisitor())).toEqual({
        $ref: '#/components/schemas/FeeBps',
    });
});

test('it unwraps a fixed size type to its inner type', () => {
    expect(visit(fixedSizeTypeNode(stringTypeNode('utf8'), 32), getSchemaVisitor())).toEqual({ type: 'string' });
});

test('it unwraps a size prefix type to its inner type', () => {
    expect(visit(sizePrefixTypeNode(stringTypeNode('utf8'), numberTypeNode('u32')), getSchemaVisitor())).toEqual({
        type: 'string',
    });
});

test('it maps a fixed-count array type with min/max items', () => {
    const result = visit(arrayTypeNode(numberTypeNode('u8'), fixedCountNode(3)), getSchemaVisitor());

    expect(result).toEqual({ items: { type: 'integer' }, maxItems: 3, minItems: 3, type: 'array' });
});

test('it maps a prefixed-count array type without min/max items', () => {
    const result = visit(
        arrayTypeNode(numberTypeNode('u8'), prefixedCountNode(numberTypeNode('u32'))),
        getSchemaVisitor(),
    );

    expect(result).toEqual({ items: { type: 'integer' }, type: 'array' });
});

test('it maps a remainder-count array type without min/max items', () => {
    const result = visit(arrayTypeNode(stringTypeNode('utf8'), remainderCountNode()), getSchemaVisitor());

    expect(result).toEqual({ items: { type: 'string' }, type: 'array' });
});

test('it maps a zero-length fixed-count array', () => {
    const result = visit(arrayTypeNode(numberTypeNode('u8'), fixedCountNode(0)), getSchemaVisitor());

    expect(result).toEqual({ items: { type: 'integer' }, maxItems: 0, minItems: 0, type: 'array' });
});

test('it maps an array of arrays, nesting the item schema', () => {
    const result = visit(
        arrayTypeNode(arrayTypeNode(numberTypeNode('u8'), fixedCountNode(2)), fixedCountNode(3)),
        getSchemaVisitor(),
    );

    expect(result).toEqual({
        items: { items: { type: 'integer' }, maxItems: 2, minItems: 2, type: 'array' },
        maxItems: 3,
        minItems: 3,
        type: 'array',
    });
});

test('it marks an option of a plain type as nullable', () => {
    const result = visit(optionTypeNode(stringTypeNode('utf8')), getSchemaVisitor());

    expect(result).toEqual({ nullable: true, type: 'string' });
});

test('it does not add nullable to an option of a $ref, since OAS 3.0 refs cannot carry siblings', () => {
    const result = visit(optionTypeNode(definedTypeLinkNode('feeBps')), getSchemaVisitor());

    expect(result).toEqual({ $ref: '#/components/schemas/FeeBps' });
});

test('it marks an option of an array type as nullable without losing its items/min/max', () => {
    const result = visit(optionTypeNode(arrayTypeNode(numberTypeNode('u8'), fixedCountNode(2))), getSchemaVisitor());

    expect(result).toEqual({ items: { type: 'integer' }, maxItems: 2, minItems: 2, nullable: true, type: 'array' });
});

test('it maps a struct type, skipping omitted discriminator fields and marking option fields as not required', () => {
    const struct = structTypeNode([
        structFieldTypeNode({ name: 'discriminator', type: numberTypeNode('u8'), defaultValueStrategy: 'omitted' }),
        structFieldTypeNode({ name: 'owner', type: publicKeyTypeNode() }),
        structFieldTypeNode({ name: 'memo', type: optionTypeNode(stringTypeNode('utf8')) }),
    ]);

    const result = visit(struct, getSchemaVisitor());

    expect(result).toEqual({
        properties: {
            owner: { description: 'base58 public key', type: 'string' },
            memo: { nullable: true, type: 'string' },
        },
        required: ['owner'],
        type: 'object',
    });
});

test('it maps an empty struct type without a required array', () => {
    expect(visit(structTypeNode([]), getSchemaVisitor())).toEqual({ properties: {}, type: 'object' });
});

test('it skips an omitted field wherever it appears, not just when it is first', () => {
    const struct = structTypeNode([
        structFieldTypeNode({ name: 'owner', type: publicKeyTypeNode() }),
        structFieldTypeNode({ name: 'padding', type: numberTypeNode('u8'), defaultValueStrategy: 'omitted' }),
        structFieldTypeNode({ name: 'balance', type: numberTypeNode('u64') }),
    ]);

    const result = visit(struct, getSchemaVisitor());

    expect(result).toEqual({
        properties: {
            owner: { description: 'base58 public key', type: 'string' },
            balance: { pattern: UNSIGNED_BIG_INT_PATTERN, type: 'string' },
        },
        required: ['owner', 'balance'],
        type: 'object',
    });
});

// A field with defaultValueStrategy "optional" is meant to be an optional parameter in generated
// APIs, but the visitor only looks at the field's *type* (optionTypeNode) to decide `required` -
// it does not special-case this strategy. Documenting the current (possibly surprising) behavior.
test('it still marks an "optional" strategy field as required when its type is not an Option', () => {
    const struct = structTypeNode([
        structFieldTypeNode({
            defaultValueStrategy: 'optional',
            name: 'amount',
            type: numberTypeNode('u64'),
        }),
    ]);

    const result = visit(struct, getSchemaVisitor());

    expect(result).toEqual({
        properties: { amount: { pattern: UNSIGNED_BIG_INT_PATTERN, type: 'string' } },
        required: ['amount'],
        type: 'object',
    });
});

test('it maps a tuple type, deduping identical slot schemas', () => {
    const result = visit(tupleTypeNode([numberTypeNode('u8'), numberTypeNode('u8')]), getSchemaVisitor());

    expect(result).toEqual({ items: { type: 'integer' }, maxItems: 2, minItems: 2, type: 'array' });
});

test('it maps a tuple type with heterogeneous slots to a oneOf of the unique schemas', () => {
    const result = visit(tupleTypeNode([numberTypeNode('u8'), stringTypeNode('utf8')]), getSchemaVisitor());

    expect(result).toEqual({
        items: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
        maxItems: 2,
        minItems: 2,
        type: 'array',
    });
});

test('it maps a single-item tuple type without wrapping its item in a oneOf', () => {
    const result = visit(tupleTypeNode([numberTypeNode('u8')]), getSchemaVisitor());

    expect(result).toEqual({ items: { type: 'integer' }, maxItems: 1, minItems: 1, type: 'array' });
});

test('it maps an empty tuple type to an array with no items schema', () => {
    const result = visit(tupleTypeNode([]), getSchemaVisitor());

    expect(result).toEqual({ maxItems: 0, minItems: 0, type: 'array' });
    expect(result.items).toBeUndefined();
});

test('it maps a C-style enum (no variant carries a payload) to a plain string enum', () => {
    const enumType = enumTypeNode([enumEmptyVariantTypeNode('Active'), enumEmptyVariantTypeNode('Paused')]);

    expect(visit(enumType, getSchemaVisitor())).toEqual({ enum: ['active', 'paused'], type: 'string' });
});

test('it maps an enum with no variants to an empty string enum, since "every" is vacuously true', () => {
    expect(visit(enumTypeNode([]), getSchemaVisitor())).toEqual({ enum: [], type: 'string' });
});

test('it maps a data-carrying enum to a oneOf of its variants', () => {
    const enumType = enumTypeNode([
        enumEmptyVariantTypeNode('None'),
        enumStructVariantTypeNode(
            'Fixed',
            structTypeNode([structFieldTypeNode({ name: 'amount', type: numberTypeNode('u64') })]),
        ),
        enumTupleVariantTypeNode('Range', tupleTypeNode([numberTypeNode('u8'), numberTypeNode('u8')])),
    ]);

    const result = visit(enumType, getSchemaVisitor());

    expect(result).toEqual({
        oneOf: [
            { enum: ['none'], type: 'string' },
            {
                properties: {
                    fixed: {
                        properties: { amount: { pattern: UNSIGNED_BIG_INT_PATTERN, type: 'string' } },
                        required: ['amount'],
                        type: 'object',
                    },
                },
                required: ['fixed'],
                type: 'object',
            },
            {
                properties: { range: { items: { type: 'integer' }, maxItems: 2, minItems: 2, type: 'array' } },
                required: ['range'],
                type: 'object',
            },
        ],
    });
});

test('it maps an enum struct variant to a wrapping object keyed by the variant name', () => {
    const variant = enumStructVariantTypeNode(
        'Fixed',
        structTypeNode([structFieldTypeNode({ name: 'amount', type: numberTypeNode('u64') })]),
    );

    expect(visit(variant, getSchemaVisitor())).toEqual({
        properties: {
            fixed: {
                properties: { amount: { pattern: UNSIGNED_BIG_INT_PATTERN, type: 'string' } },
                required: ['amount'],
                type: 'object',
            },
        },
        required: ['fixed'],
        type: 'object',
    });
});

test('it maps an enum tuple variant to a wrapping object keyed by the variant name', () => {
    const variant = enumTupleVariantTypeNode('Range', tupleTypeNode([numberTypeNode('u8'), numberTypeNode('u8')]));

    expect(visit(variant, getSchemaVisitor())).toEqual({
        properties: { range: { items: { type: 'integer' }, maxItems: 2, minItems: 2, type: 'array' } },
        required: ['range'],
        type: 'object',
    });
});

test.each(UNHANDLED_KINDS)('it throws for the unsupported registered kind "%s"', kind => {
    expect(() => visit({ kind } as never, getSchemaVisitor())).toThrow(`Unsupported type node "${kind}"`);
});
