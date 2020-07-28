const DEP_VALUE = 'webinar';
const DEP_CREATE_NEW_VALUE = false;

tray.on('CONFIG_SLOT_MOUNT', async ({ event, previousWizardState, previousSlotState }) => {
    const dependentSlotValue = previousWizardState.values[tray.env.meetingOrWebinarSelector];
    const dependentCreateNewValue = previousWizardState.values[tray.env.newOrExisting];
    if(dependentSlotValue != DEP_VALUE && dependentCreateNewValue != DEP_CREATE_NEW_VALUE){
        //Return to display
        return{
            ...previousSlotState,
            status:'HIDDEN'
        };
    }
    return loadWebinarRecords(previousWizardState,previousSlotState);
});

tray.on('CONFIG_SLOT_VALUE_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    const getValueOfDependent = event.data.value;
    const isDependentSlot = event.data.externalId === tray.env.meetingOrWebinarSelector;
    if (!isDependentSlot){
        return;
    }
    // wait until the entity type has been selected before showing the field
    if (getValueOfDependent === DEP_VALUE) {
        
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

    if (dependentSlotValue != DEP_VALUE) {
        return {
            ...event.data,
            status: 'HIDDEN'
        };
        
    } else if (event.data.status === 'LOADING') {
        return loadWebinarRecords(previousWizardState,previousSlotState);
    }
});

async function loadWebinarRecords(previousWizardState,previousSlotState){
    const userId =  previousWizardState.values[tray.env.userIdSlot];
    const zoomAuthId = previousWizardState.values[tray.env.zoomAuthId];
    const inputData = {
        "page_number": 1,
        "page_size": 300,
        "user_id": userId
    };

    //Make a call to the list users endpoint
    const fetchWebinarRecords = await tray.callConnector({
        connector: 'zoom',
        version: '1.5',
        operation: 'list_webinars',
        // we are able to use the authentication from any service just like in the workflow builder
        authId: zoomAuthId,
        input: inputData
    });
    
    console.log(JSON.parse(fetchWebinarRecords));

    //Format the endpoint for selection
    const webinarsMap = JSON.parse(fetchWebinarRecords).webinars.map((userObject)=>({
        value: userObject.id,
        text: userObject.topic
    })).sort((firstEl, secondEl)=> (firstEl.text > secondEl.text ? 1: -1));
    
    //Returnl to display
    return{
        ...previousSlotState,
        status:'VISIBLE',
        jsonSchema: {
            "title": "Webinars",
            "default":"",
            "type":"string",
            "enum":webinarsMap
        }
    };
}