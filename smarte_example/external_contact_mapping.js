/* Note this is a POC and does not hook up to live data
It is intended to demonstrate the following functionality in the custom javascript component
- A table layout mapping array
- Required field enforcement
- One-to-one mapping enforcement
- Default mappings
- Ability to show/hide mapping component based on the value of a previous boolean config slot*/

const REQUIRED_SALESFORCE_FIELDS = [
	{
		text: 'Last name',
		value: 'lastName'
	}
];
const REQUIRED_IG_FIELDS = [  ];
const DEFAULT_MAPPING = [
	{
		key: 'igLastName',
		value: 'lastName'
	}
];

// Simulate Saleforce fields for the Contact object
const sfFields = [
	{text: 'First Name', value: 'firstName'},
	{text: 'Last Name', value: 'lastName'}
];

// Simulate SMARTe fields for the Contact object
const igFields = [
	{text:'IG First Name', value: 'igFirstName:string'},
	{text:'IG Last Name', value: 'igLastName:string'}
];

const validateValues = (event) => {
	console.log('event', event);
	/* return validation object based on if valid
	return {} if valid
		return {
		status: 'ERROR',
		message: 'The error message'
	}; if not valid */
	const ig_values = event.data.value.filter(field => field !== null).map(field => field.key);
	console.log('ig_values', ig_values);
	const salesforce_values = event.data.value.filter(field => field !== null).map(field => field.value);
	console.log('salesforce_values', salesforce_values);

	const ig_unmapped_required_fields = REQUIRED_IG_FIELDS.filter(required_field => !ig_values.includes(required_field.value));
	const salesforce_unmapped_required_fields = REQUIRED_SALESFORCE_FIELDS.filter(required_field => !salesforce_values.includes(required_field.value));
	return (
		ig_unmapped_required_fields.length || salesforce_unmapped_required_fields.length ?
		{
			status: 'ERROR',
			message: `You have an error in your mapping. The following fields are required to be mapped -
			${ig_unmapped_required_fields.length ? `\nIG fields: ${ig_unmapped_required_fields.map(field => field.text).join()}` : ''}
			${salesforce_unmapped_required_fields.length ? `\nSalesforce fields: ${salesforce_unmapped_required_fields.map(field => field.text).join()}` : ''}`
		} :
		{}
	);
};

const baseItemsSchema = {
	type: 'object',
	additionalProperties: false,
	title: 'Contact mapping'
};

const itemsResolve = (event, ig_fields_mapped, salesforce_fields_mapped) => (
	event.data.value && event.data.value.length ?
	event.data.value.map(row_value => {
		const { key, value } = row_value === null ? ({ key: undefined, value: undefined }) : row_value;
		console.log('key', key);
		console.log('value', value);
		return {
			...baseItemsSchema,
			properties: {
				key: {
					title: 'IG Field',
					type: 'string',
					enum: igFields
					.filter(field => (
						!ig_fields_mapped.filter(mapped_field => mapped_field !== key)
						.includes(field.value)
					))
				},
				value: {
					title: 'Salesforce Field',
					type: 'string',
					enum: sfFields
					.filter(field => (
						!salesforce_fields_mapped.filter(mapped_field => mapped_field !== value)
						.includes(field.value)
					))
				}
			},
			additionalProperties: false,
			title: 'Contact mapping'
		};
	}) :
	{
		...baseItemsSchema,
		properties: {
			key: {
				title: 'IG Field',
				type: 'string',
				enum: igFields
			},
			value: {
				title: 'Salesforce Field',
				type: 'string',
				enum: sfFields
			}
		}
	}
);

const resolveSlot = async (event, previousWizardState) => {

	console.log('event', event);

	if (event.data.externalId !== tray.env.slotExternalId) return;

	const wizardValues = previousWizardState.values;
	const mapContact = wizardValues.external_map_contact;
	console.log(mapContact);
	let jsonSchema = {};

	let event_value = event.data.value || [];

	console.log('event_value', event_value);

	event_value = event_value.filter(row => {
		console.log('row', row);
		if (row !== null && row.key === null && row.value === null) {
			console.log('remove row');
			return false;
		} else {
			return true;
		}
	});

	console.log('event_value', event_value);

	const parsed_event = {
		...event,
		data: {
			...event.data,
			value: event_value
		}
	};

	console.log('parsed_event', parsed_event);

	const ig_fields_mapped = event_value.length ? event_value.filter(field => field !== null).map(field => field.key) : [];
	const salesforce_fields_mapped = event_value.length ? event_value.filter(field => field !== null).map(field => field.value) : [];

	const itemsResolved = itemsResolve(parsed_event, ig_fields_mapped, salesforce_fields_mapped);

	console.log('itemsResolved', itemsResolved);

	if (event.type === 'CONFIG_SLOT_MOUNT') {

		const sfAuth = wizardValues.external_salesforce_authentication;
		let properties = {};

		jsonSchema = {
			type: 'array',
			title: 'Contact mappings',
			items: itemsResolved,
			table: { key: 'IG Field', value: 'Salesforce Field' },
			additionalItems: true
		};

	} else {

		jsonSchema = {
			...event.data.jsonSchema,
			items: itemsResolved,
			table: { key: 'IG Field', value: 'Salesforce Field' },
			additionalItems: {
				type: 'object',
				properties: {
					key: {
						title: 'IG Field',
						type: 'string',
						enum: igFields
						.filter(field => !ig_fields_mapped.includes(field.value))
					},
					value: {
						title: 'Salesforce Field',
						type: 'string',
						enum: sfFields
						.filter(field => !salesforce_fields_mapped.includes(field.value))
					}
				},
				additionalProperties: false,
				title: 'Contact mapping'
			}
		}

	}

	if (mapContact) {

		console.log('event_value', event_value);

		const output = {
			...event.data,
			status: 'VISIBLE',
			jsonSchema,
			value: (event.type === 'CONFIG_SLOT_MOUNT' && !event_value.length ? DEFAULT_MAPPING : event_value),
			validation: (
				parsed_event === []
				? {}
				: event.type === 'CONFIG_SLOT_MOUNT' && !event_value.length ? {} : validateValues(event)
			)
		};

		console.log('output', output);

		return output;

	} else {
		return {
			...event.data,
			status: 'HIDDEN',
			value: []
		};
	}
	
}

tray.on('CONFIG_SLOT_MOUNT', async ({ event, previousWizardState, previousSlotState }) => {
	return await resolveSlot(event, previousWizardState);
});

tray.on('CONFIG_SLOT_VALUE_CHANGED', async ({ event, previousWizardState }) => {
	return await resolveSlot(event, previousWizardState)
});
