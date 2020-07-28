
var DEPENDENT_VALUES = [{env:'meetingOrWebinarSelector',value:'meeting'},
{
    env:'newOrExisting',
    value:false
}];

const DEP_VALUE = 'meeting';
const DEP_CREATE_NEW_VALUE = false;

tray.on('CONFIG_SLOT_MOUNT', async ({ event, previousWizardState, previousSlotState }) => {
    const dependentSlotValue = previousWizardState.values[tray.env.meetingOrWebinarSelector];
    const dependentCreateNewValue = previousWizardState.values[tray.env.newOrExisting];
    if(dependentSlotValue != DEP_VALUE && dependentCreateNewValue == DEP_CREATE_NEW_VALUE){
        //Return to display
        return{
            ...previousSlotState,
            status:'HIDDEN'
        };
    }
    return loadMeetingRecords(previousWizardState,previousSlotState);
});

tray.on('CONFIG_SLOT_VALUE_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    const getValueOfDependent = event.data.value;
    
    const isDependentSlot = (event.data.externalId === tray.env.meetingOrWebinarSelector || event.data.externalId===tray.env.newOrExisting);
    if (!isDependentSlot){
        return;
    }
    const dependentSlotValue = previousWizardState.values[tray.env.meetingOrWebinarSelector];
    const dependentCreateNewValue = previousWizardState.values[tray.env.newOrExisting];
    if(dependentSlotValue != DEP_VALUE && dependentCreateNewValue != DEP_CREATE_NEW_VALUE){
        
        return {
            ...previousSlotState,
            status: 'LOADING'
        };
        
    } else{
        return {
            ...previousSlotState,
            status: 'HIDDEN'
        };
        
    }	
});

tray.on('CONFIG_SLOT_STATUS_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    const isMySlot = event.data.externalId === tray.env.slotExternalId;   
    if (!isMySlot){
        return;
    }

    const dependentSlotValue = previousWizardState.values[tray.env.meetingOrWebinarSelector];
    const dependentCreateNewValue = previousWizardState.values[tray.env.newOrExisting];
    if(dependentSlotValue != DEP_VALUE && dependentCreateNewValue != DEP_CREATE_NEW_VALUE){
        return {
            ...event.data,
            status: 'HIDDEN'
        };
        
    } else if (event.data.status === 'LOADING') {
        return loadMeetingRecords(previousWizardState,previousSlotState);
    }

});

async function loadMeetingRecords(previousWizardState,previousSlotState){
    const userId =  previousWizardState.values[tray.env.userIdSlot];
    const zoomAuthId = previousWizardState.values[tray.env.zoomAuthId];
    const inputData = {
        "page_number": 1,
        "page_size": 300,
        "user_id": userId
    };

    //Make a call to the list users endpoint
    const fetchMeetingRecords = await tray.callConnector({
        connector: 'zoom',
        version: '1.5',
        operation: 'list_meetings',
        // we are able to use the authentication from any service just like in the workflow builder
        authId: zoomAuthId,
        input: inputData
    });

    //Format the endpoint for selection
    const meetingsMap = JSON.parse(fetchMeetingRecords).meetings.map((userObject)=>({
        value: userObject.id,
        text: userObject.topic
    })).sort((firstEl, secondEl)=> (firstEl.text > secondEl.text ? 1: -1));
    
    //Return to display
    return{
        ...previousSlotState,
        status:'VISIBLE',
        jsonSchema: {
            "title": "Meetings",
            "default":"",
            "type":"string",
            "enum":meetingsMap
        }
    };
}