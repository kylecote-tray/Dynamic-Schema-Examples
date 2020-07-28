
var DEPENDENT_VALUES = [{env:'meetingOrWebinarSelector',value:'webinar'},{env:'newOrExisting',value:false}];

tray.on('CONFIG_SLOT_MOUNT', async ({ event, previousWizardState, previousSlotState }) => {
    if(!meetsDependencies(event,previousWizardState,DEPENDENT_VALUES)){
        return{
            ...previousSlotState,
            status:'HIDDEN'
        };
    }
    return loadMeetingRecords(previousWizardState,previousSlotState);
});

tray.on('CONFIG_SLOT_VALUE_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    const getValueOfDependent = event.data.value;
    const isDependentSlot = DEPENDENT_VALUES.filter(dep => tray.env[dep.env] === event.data.externalId).length >0;
    if (!isDependentSlot){
        return;
    }
    if(!meetsDependencies(event,previousWizardState,DEPENDENT_VALUES)){
        return{
            ...previousSlotState,
            status:'HIDDEN'
        };
    }
    return {
        ...previousSlotState,
        status: 'LOADING'
    };
});

tray.on('CONFIG_SLOT_STATUS_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    const isMySlot = event.data.externalId === tray.env.slotExternalId;   
    if (!isMySlot){
        return;
    }
    if(!meetsDependencies(event,previousWizardState,DEPENDENT_VALUES)){
        return{
            ...event.data,
            status:'HIDDEN'
        };
    }
    if (event.data.status === 'LOADING') {
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
    const webinarRecords = await tray.callConnector({
        connector: 'zoom',
        version: '1.5',
        operation: 'list_webinars',
        // we are able to use the authentication from any service just like in the workflow builder
        authId: zoomAuthId,
        input: inputData
    });

    //Format the endpoint for selection
    const webinarsMap = JSON.parse(webinarRecords).webinars.map((userObject)=>({
        value: userObject.id,
        text: userObject.topic
    })).sort((firstEl, secondEl)=> (firstEl.text > secondEl.text ? 1: -1));
    
    //Return to display
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

function meetsDependencies(event,previousWizardState,dependencies){
    return dependencies.filter(dep => {
        const externalId = tray.env[dep.env];
        if(previousWizardState.values[externalId] == dep.value || (externalId == event.data.externalId && event.data.value == dep.value))
            return dep;
    }).length == dependencies.length;
}