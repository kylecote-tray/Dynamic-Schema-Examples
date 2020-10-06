//=============--------------------=============
//Template by Tray.io Solutions
//=============--------------------=============


//Constant Varabiles used for static elements on page
const TABLE_TITLE = 'Greenhouse >> Personio Mappings';
const LHS_TITLE = 'Greenhouse Field';
const RHS_TITLE = 'Personio Attribute';
const REQUIRED_MAPPINGS = [{'value':'first_name'},{'value':'last_name'},{'value':'email'}]
const OPTIONAL_MAPPINGS = [{'value':'department'}]

//You can customize the left-hand-side objects/fields used to be passed down into population (see leftHandSideFieldsEnum)
const lhsStaticObjectFields = {
    "Offer":[
        {"text":"Id",
            "value":"id"},
        {"text":"Version",
            "value":"version"},
        {"text":"Starts At",
            "value":"starts_at"},
        {"text":"Created At",
            "value":"created_at"},
        {"text":"Resolved At",
            "value":"resolved_at"},
        {"text":"Status",
            "value":"status"},
    ],
    "Candidate":[
        {"text":"Id",
            "value":"id"},
        {"text":"Company",
            "value":"company"},
        {"text":"Title",
            "value":"title"},
        {"text":"Phone Numbers",
            "value":"phone_numbers"},
        {"text":"Addresses",
            "value":"addresses"},
        {"text":"Email Addresses",
            "value":"email_addresses"},
        {"text":"Website Addresses",
            "value":"website_addresses"},
    ]
};

const rhsStaticFields = [{'text':'Email','value':'email'},
    {'text':'First Name','value':'first_name'},
    {'text':'Last Name','value':'last_name'},
    {'text':'Gender','value':'gender'},
    {'text':'Position','value':'position'},
    {'text':'Hire Date','value':'hire_date'},
    {'text':'Weekly Working Hours','value':'weekly_working_hours'},
    {'text':'Subcompany','value':'subcompany'},
    {'text':'Department','value':'department'},
    {'text':'Office','value':'office'}
];

//Left hand side of Table customization
//lhsAuthId - designated inside `handleEvent` and used in callConnector calls in method
async function getLeftHandSideFieldsEnum(lhsAuthId){
    let lhsFields = [];
    for (const lhsObjectType in lhsStaticObjectFields){
        lhsFields = lhsFields.concat(lhsStaticObjectFields[lhsObjectType].map(curStaticField=>{
            return {
                text: lhsObjectType +": " + curStaticField.text,
                value: lhsObjectType + "__static__" + curStaticField.value
            }
        }));
        const customFieldsResponse = await getLeftHandSideCustomFields(lhsAuthId,lhsObjectType);
        let customFields = JSON.parse(customFieldsResponse).results.map(curCustomField=>{
            return{
                text: lhsObjectType +": " + curCustomField.name,
                value: lhsObjectType + "__custom__" + curCustomField.name_key
            }
        });
        lhsFields = lhsFields.concat(customFields);
    }
    let lhsFieldsEnum = await Promise.all(
        lhsFields.map(mappedField=>{
            return{text:mappedField.text,value:mappedField.value}}).sort((first,second) => (
                first.text > second.text ? 1 : -1)));
    return {type:'string',enum:lhsFieldsEnum};
}

//Right hand side of Table customization
async function getRightHandSideFieldsEnum(rhsAuthId){
    const fieldResponse = await getPersonioFields(rhsAuthId);
    let fields = JSON.parse(fieldResponse).data.map(curField=>{
        return{
            text:curField.label,
            value:curField.key
        }
    });
    let filteredStatics = rhsStaticFields.map((staticField)=>{
        if(fields.filter(field => field.value == staticField.value).length == 0)
        {
            return staticField;
        }
    });
    fields.push(...filteredStatics);
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

    const items = await Promise.all(
        configMetaData.tableValues.map(rowValues =>
            getRowSchema({
                ...configMetaData,
                rowValues,
            }))
    );

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