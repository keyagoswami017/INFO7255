const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, strict: false });

function validateSchema(schema, data) {
    const validate = ajv.compile(schema);
    const valid = validate(data);
        return {
            valid,
            errors: validate.errors || []
        };
    }

module.exports = { validateSchema };

   
