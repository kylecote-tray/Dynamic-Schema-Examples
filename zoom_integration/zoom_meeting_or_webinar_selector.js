tray.on('CONFIG_SLOT_MOUNT', async ({ event, previousWizardState, previousSlotState }) => {
    if(!meetsDependencies(event,previousWizardState,DEPENDENT_VALUES)){
        return{
            ...previousSlotState,
            status:'HIDDEN'
        };
    }
    return loadMeetingRecords(previousWizardState,previousSlotState);
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
        operation: 'list_webinars',
        // we are able to use the authentication from any service just like in the workflow builder
        authId: zoomAuthId,
        input: inputData
    });
    if

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