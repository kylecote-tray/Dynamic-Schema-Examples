//=============--------------------=============
//Template by Tray.io Solutions
//=============--------------------=============


//Constant Varabiles used for static elements on page
const TABLE_TITLE = 'Greenhouse >> Personio Mappings';
const LHS_TITLE = 'Greenhouse Field';
const RHS_TITLE = 'Personio Attribute';
const REQUIRED_MAPPINGS = [
                            {'key': 'candidate.first_name', 'value':'first_name'},
                            {'key': 'candidate.last_name', 'value':'last_name'},
                            {'key': 'candidate.email_addresses[0].value', 'value':'email'},
                        ]
const OPTIONAL_MAPPINGS = [
                            {'key': 'job.departments[0].name', 'value':'department'},
                            {'key': 'job.offices[0].name', 'value': 'office'},
                            {'key': 'offer.starts_at', 'value': 'hire_date'},
                            {'key': 'job.name', 'value': 'position'},
                        ]

//You can customize the left-hand-side objects/fields used to be passed down into population (see leftHandSideFieldsEnum)
const lhsStaticObjectFields = {
    "offer":[
        {"text":"Starts At", "value":"starts_at"},
        {"text":"Sent At", "value":"sent_at"},
    ],
    "candidate":[
        {"text":"Email Address", "value":"email_addresses[0].value"},
        {"text":"First Name", "value":"first_name"},
        {"text":"Last Name", "value":"last_name"},
        {"text":"Title", "value":"title"},
        {"text":"Phone Numbers", "value":"phone_numbers[0].value"},
        {"text":"Address", "value":"addresses[0].value"},
    ],
    "job": [
      	{"text": "Name", "value": "name"},
        {"text": "Office", "value": "offices[0].name"},
        {"text": "Department", "value": "departments[0].name"},
    ]
};

const rhsStaticFields = ['email', 'first_name', 'last_name', 'gender', 'position', 'hire_date', 'weekly_working_hours', 'subcompany', 'department', 'office'];

//Left hand side of Table customization
//lhsAuthId - designated inside `handleEvent` and used in callConnector calls in method
function getLeftHandSideFieldsEnum(lhsAuthId){
    let lhsFields = [];
    let requesters = [];
    for (const lhsObjectType in lhsStaticObjectFields){
        requesters.push(getLeftHandSideCustomFields(lhsAuthId, lhsObjectType));
    }

    return Promise.all(requesters)
        .then((values) => {
            for (const lhsObjectType in lhsStaticObjectFields) {
                lhsFields = lhsFields.concat(lhsStaticObjectFields[lhsObjectType].map(curStaticField=>{
                    return {
                        text: _.capitalize(lhsObjectType) +": " + curStaticField.text,
                        value: lhsObjectType + "." + curStaticField.value
                    }
                }));
            }
            for (const customFieldsResponse of values) {
                let customFields = JSON.parse(customFieldsResponse).results.map(curCustomField=>{
                    return{
                        text: _.capitalize(curCustomField.field_type) +": " + curCustomField.name,
                        value: curCustomField.field_type + ".custom_fields." + curCustomField.name_key
                    }
                });
                lhsFields = lhsFields.concat(customFields);
            }

            let lhsFieldsEnum = lhsFields.sort((first,second) => (first.text > second.text ? 1 : -1));
            return {type:'string',enum:lhsFieldsEnum};
        });
}

//Right hand side of Table customization
async function getRightHandSideFieldsEnum(rhsAuthId){
    const fieldResponse = await getPersonioFields(rhsAuthId);
    let fields = JSON.parse(fieldResponse).data.map(curField=>{
        return{
            text:curField.label,
            value: rhsStaticFields.includes(curField.key) ? curField.key : "custom_attributes." + curField.key 
        }
    });
    
    fields.sort((first,second)=>(first.text > second.text ? 1 : -1));
    return {
        type:'string',
        enum:fields};
}

//Get the custom fields for the leftHandSide & handle caching
//lhsAuthId -> authId for the lefthandSide
//fieldType -> object type to pass in on the lhs
function getLeftHandSideCustomFields(lhsAuthId,fieldType){
    const cacheKey = lhsAuthId + fieldType;
    if(!CACHE[cacheKey]){
    CACHE[cacheKey] = tray.callConnector({
            connector: 'greenhouse',
                version: '1.3',
                operation: 'list_custom_fields',
                authId: lhsAuthId,
                input: {
                    field_type: fieldType.toLowerCase(),
                    include_inactive:false
                }
        });
    }
    return CACHE[cacheKey];
}

//Get the personio fields + handle caching
function getPersonioFields(personioAuthId){
    const cacheKey = personioAuthId;
    if(!CACHE[cacheKey]){
    CACHE[cacheKey] = tray.callConnector({
            connector: 'personio',
                version: '1.0',
                operation: 'list_custom_attributes',
                authId: personioAuthId,
                input: {}
        });
    }
    return CACHE[cacheKey];
}


//=============--------------------=============
//No need to change elements below this line
//=============--------------------=============

tray.on('CONFIG_SLOT_MOUNT', handleEvent);
tray.on('CONFIG_SLOT_VALUE_CHANGED', handleEvent);
tray.on('AUTH_SLOT_VALUE_CHANGED', handleEvent);

//Dynamic variables that hold data
let CACHE = {};

//Global handlers for events
async function handleEvent({ event, previousSlotState, previousWizardState }) {
    const lhsAuthId = getValue(event.data,previousWizardState.values,tray.env.lhsAuthExternalId);
    const rhsAuthId = getValue(event.data,previousWizardState.values,tray.env.rhsAuthExternalId);
    const isMySlot = event.data.externalId === tray.env.slotExternalId;
    if(!isMySlot){
        return;
    }
    else if (event.type === 'CONFIG_SLOT_VALUE_CHANGED' && !doesNewValueRequireJsonSchemaUpdate(event.data, previousSlotState)){
        const lastTableState = getValue(event.data, previousWizardState.values, tray.env.slotExternalId);
        let tableValues = getTableValuesAfterEnforcingRules(lastTableState);
        return {
            ...previousSlotState,
            value: tableValues,
      };
    }
    
    const lastTableState = getValue(event.data, previousWizardState.values, tray.env.slotExternalId);
    let tableValues = getTableValuesAfterEnforcingRules(lastTableState);
    const jsonSchema = await getTableSchema({
        lhsAuthId,
        rhsAuthId,
        tableValues
    });

    return {
        ...previousSlotState,
        value: tableValues,
        status:'VISIBLE',
        jsonSchema
    }

}

//Handler for getting the table schema
async function getTableSchema(configMetaData){
    console.log(Date.now());
    const items = await Promise.all(
        configMetaData.tableValues.map(rowValues =>
            getRowSchema({
                ...configMetaData,
                rowValues,
            }))
    );
    console.log(Date.now());
    console.log(items);
    
    //Return the table
    return {
        title: TABLE_TITLE,
        table:{
            key:LHS_TITLE,
            value:RHS_TITLE,
        },
        items,
        additionalItems:true
    };

}

async function getRowSchema(configMetaData){
    return {
        type:'object',
        properties:{
            key: await getLeftHandSideFieldsEnum(configMetaData.lhsAuthId),
            value: await getRightHandSideFieldsEnum(configMetaData.rhsAuthId)
        },
        additionalProperties: false
    }
}

//Gets the table values after enforcing the RHS/LHS rules
function getTableValuesAfterEnforcingRules(tableValues){
  let definedTableState = tableValues === undefined? OPTIONAL_MAPPINGS: tableValues;
  console.log(definedTableState);
  for(const curReqIndex in REQUIRED_MAPPINGS){
    const curMap = REQUIRED_MAPPINGS[curReqIndex];
    let curMapKey = curMap.hasOwnProperty('key') ? curMap['key']:undefined;
    let curMapValue = curMap.hasOwnProperty('value') ? curMap['value']:undefined;
    let requiredMatch = [];
    //Full map search
    if(curMapKey && curMapValue){
      requiredMatch = definedTableState.filter(filterRow => filterRow == curMap);
    }
    //Key Search
    else if (curMapKey){
      requiredMatch = definedTableState.filter(filterRow => (filterRow != null && filterRow.hasOwnProperty('key') && filterRow.key == curMapKey));
    }
    //Value Search
    else{
      requiredMatch = definedTableState.filter(filterRow => (filterRow != null && filterRow.hasOwnProperty('value') && filterRow.value == curMapValue));
    }
    if(requiredMatch.length == 0){
      definedTableState.unshift(curMap);
    }
  }
  return definedTableState.filter(item=> (item === null || !((item.hasOwnProperty('key') && item.key == null)
                                                             &&(item.hasOwnProperty('value') && item.value == null))));
}

// Util function to get the latest value of a specific slot
function getValue(eventData, wizardStateValues, targetExternalId) {
    return eventData.externalId === targetExternalId
        ? eventData.value
        : wizardStateValues[targetExternalId];
}

//Determines if the value requires an update to append items
function doesNewValueRequireJsonSchemaUpdate(eventData, previousSlotState) {
    const previousValue = previousSlotState.value || [];
    const currentValue = eventData.value || [];

    return currentValue.some((row, rowIndex) => {
        const previousRow = previousValue[rowIndex] || {};

        if (!row || !previousRow) {
            return true;
        }
        return row.key !== previousRow.key;
    });
}