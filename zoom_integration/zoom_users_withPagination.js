var currentPage = 1;
var maxPage = undefined;
var CACHE = {};

tray.on('CONFIG_SLOT_MOUNT', async ({ event, previousWizardState, previousSlotState }) => {
    const isMySlot = event.data.externalId === tray.env.slotExternalId;
    const isAuthSlot = event.data.externalId === tray.env.zoomAuthId;
    if (!isMySlot && !isAuthSlot){
        return;
    }
    return loadUsers(previousWizardState,previousSlotState);
});

tray.on('CONFIG_SLOT_VALUE_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    const isMySlot = event.data.externalId === tray.env.slotExternalId;
    const isAuthSlot = event.data.externalId === tray.env.zoomAuthId;
    if (!isMySlot && !isAuthSlot){
        return;
    }
    if(event.data.value ==='MORE'){
        currentPage += 1;
        return {
            ...previousSlotState,
            status: 'LOADING'
        };
    }
    if(event.data.value === 'PREVIOUS'){
        currentPage = currentPage-1 >1?currentPage-1:1;
        return {
            ...previousSlotState,
            status: 'LOADING'
        };
    }
    return {
        ...event.data.value,
        status: 'VISIBLE'
    };

});

tray.on('CONFIG_SLOT_STATUS_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    const isMySlot = event.data.externalId === tray.env.slotExternalId;   
    if (!isMySlot){
        return;
    }

    if (event.data.status === 'LOADING') {
        return loadUsers(previousWizardState,previousSlotState);
    }
});

async function loadUsers(previousWizardState,previousSlotState){
    const userId =  previousWizardState.values[tray.env.userIdSlot];
    const zoomAuthId = previousWizardState.values[tray.env.zoomAuthId];
    const cache_key = "page_"+String(currentPage);
    if(!CACHE[cache_key]){
        const inputData = {
            "page_number": currentPage,
            "page_size": 300,
            "user_id": userId
        };

        var fetchUserRecords = await tray.callConnector({
            connector: 'zoom',
            version: '1.5',
            operation: 'list_users',
            // we are able to use the authentication from any service just like in the workflow builder
            authId: zoomAuthId,
            input: inputData
        });
        
        //Format the endpoint for selection
        const jsonResp = JSON.parse(fetchUserRecords);
        const meetingsMap = jsonResp.users.map((userObject)=>({
            value: userObject.id,
            text: userObject.first_name + " " + userObject.last_name
        })).sort((firstEl, secondEl)=> (firstEl.text > secondEl.text ? 1: -1));
        maxPage = jsonResp.page_count;
        if (currentPage > 1){
            meetingsMap.unshift({'text':'Previous Users',value:'PREVIOUS'});
        }
        if (currentPage < maxPage){
            meetingsMap.unshift({'text':'More Users',value:'MORE'});
        }
        CACHE[cache_key] = meetingsMap;
    }
    
    //Return to display
    return{
        ...previousSlotState,
        status:'VISIBLE',
        jsonSchema: {
            "title": "Meetings",
            "default":"",
            "type":"string",
            "enum":CACHE[cache_key]
        },
    };    
}