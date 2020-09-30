var currentPage = 1;
var maxPage = undefined;
var CACHE = {};

tray.on('AUTH_SLOT_VALUE_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    const isZoomSlot = event.data.externalId === tray.env.zoomAuthId;
    if (!isZoomSlot){
        return;
    }
    clearCacheWithAuth(getValue(event,previousWizardState.values,tray.env.zoomAuthId));
    return {
        ...previousSlotState,
        value:undefined,
        validation:true,
        status: 'LOADING'
    };
});

tray.on('CONFIG_SLOT_MOUNT', async ({ event, previousWizardState, previousSlotState }) => {
    const isMySlot = event.data.externalId === tray.env.slotExternalId;
    if (!isMySlot){
        return;
    }
    return loadUsers(getValue(event,previousWizardState.values,tray.env.zoomAuthId),previousWizardState,previousSlotState);
});

tray.on('CONFIG_SLOT_VALUE_CHANGED', async ({ event, previousWizardState, previousSlotState }) => {
    const isMySlot = event.data.externalId === tray.env.slotExternalId;
    const isAuthSlot = event.data.externalId === tray.env.zoomAuthId;
    const zoomAuthId = getValue(event,previousWizardState.values,tray.env.zoomAuthId);
    const error_key = String(zoomAuthId + '_errors');
    if (!isMySlot && !isAuthSlot){
        return;
    }
    if(event.data.value ==='MORE'){
        currentPage += 1;
    }

    if(event.data.value === 'PREVIOUS'){
        currentPage = currentPage-1 >1?currentPage-1:1;
    }

    if((isMySlot && ['REFRESH','MORE','PREVIOUS'].includes(event.data.value))){
        return {
            ...previousSlotState,
            status: 'LOADING'
        };
    }

    if(CACHE[error_key] || (isMySlot && event.data.value ==='ERROR')){
        return getErrorResponse(previousSlotState);
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
        return loadUsers(getValue(event,previousWizardState.values,tray.env.zoomAuthId),previousWizardState,previousSlotState);
    }
});

async function loadUsers(zoomAuthId,previousWizardState,previousSlotState){
    const error_key = String(zoomAuthId + '_errors');
    try{
        const cache_key = String(zoomAuthId+ "_page_"+currentPage);
        if(!CACHE[cache_key]){
            const inputData = {
                "page_number": currentPage,
                "page_size": 300
            };

            var fetchUserRecords = await tray.callConnector({
                connector: 'zoom',
                version: '1.5',
                operation: 'list_users',
                authId: zoomAuthId,
                input: inputData
            });
            
            //Format the endpoint for selection
            const jsonResp = JSON.parse(fetchUserRecords);
            const usersMap = jsonResp.users.map((userObject)=>({
                value: userObject.id,
                text: userObject.first_name + " " + userObject.last_name
            })).sort((firstEl, secondEl)=> (firstEl.text > secondEl.text ? 1: -1));
            maxPage = jsonResp.page_count;
            if (currentPage > 1){
                usersMap.unshift({'text':'Previous Users',value:'PREVIOUS'});
            }
            if (currentPage < maxPage){
                usersMap.unshift({'text':'More Users',value:'MORE'});
            }
            CACHE[cache_key] = usersMap;
        }
        if(CACHE[error_key]){
            delete CACHE[error_key];
        }

        //Return to display
        return{
            ...previousSlotState,
            status:'VISIBLE',
            jsonSchema: {
                "title": "Zoom User",
                "default":"",
                "type":"string",
                "enum":CACHE[cache_key]
            },
        };    
    }
    catch (ex){
        CACHE[error_key] = 'Please check your Zoom authentication slot entry. Your selected authentication is either invalid or a problem occurred while refreshing the authentication. If this continues to persist please reach out to support.';
        return getErrorResponse(previousSlotState)
    }
}

function getValue(eventData, wizardStateValues, targetExternalId) {
    return eventData.externalId === targetExternalId
        ? eventData.value
        : wizardStateValues[targetExternalId];
}

function clearCacheWithAuth(auth){
    var entries = Object.entries(CACHE);
    for(const keyToCheck in entries){
        if(keyToCheck[0].includes(String(auth))){
            delete CACHE[keyToCheck[0]];
        }
    }
}

function getErrorResponse(previousSlotState){
    return {
        ...previousSlotState,
        value:undefined,
        validation:{
            status:'ERROR',
            message: 'Please check your Zoom authentication slot entry. Your selected authentication is either invalid or a problem occurred while refreshing the authentication. If this continues to persist please reach out to support.'
        },
        jsonSchema: {
            "title": "Zoom User",
            "default":"",
            "type":"string",
            "enum":[{text:'Please use the top dropdown to select a valid Zoom account.',value:'ERROR'},
            {text:'Refresh',value:'REFRESH'}]
        },
        status:'VISIBLE'
    }
}