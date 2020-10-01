//Globals for slot
var DEPENDENT_VALUES = [{env:'meetingOrWebinarSelector',value:'webinar'},{env:'newOrExisting',value:false}];
var currentPage = 1;
var maxPage = undefined;
var CACHE = {};

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
    const isMySlot = event.data.externalId === tray.env.slotExternalId;
    if (!(isDependentSlot || isMySlot)){
        return;
    }
    if(!meetsDependencies(event,previousWizardState,DEPENDENT_VALUES)){
        return{
            ...previousSlotState,
            value:undefined,
            status:'HIDDEN'
        };
    }
    const error_key = String(previousWizardState.values[tray.env.zoomAuthId] + '_errors');
    if(CACHE[error_key] || (isMySlot && event.data.value ==='ERROR')){
        return getErrorResponse(previousSlotState);
    }

    if(event.data.value ==='MORE'){
        currentPage += 1;
    }
    if(event.data.value === 'PREVIOUS'){
        currentPage = currentPage-1 >1?currentPage-1:1;
    }

    if (!isMySlot || (isMySlot && ['REFRESH','MORE','PREVIOUS'].includes(event.data.value))){
        return {
            ...previousSlotState,
            status: 'LOADING'
        };
    }

    return{
        ...event.data.value,
        status: 'VISIBLE'
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
    const zoomAuthId = previousWizardState.values[tray.env.zoomAuthId];
    const error_key = String(zoomAuthId + '_meetingErrors');
    const userId =  previousWizardState.values[tray.env.userIdSlot];
    try{
        const cache_key = String(zoomAuthId+ "_meetingPage_"+currentPage);
        if(!CACHE[cache_key]){
            const inputData = {
                "page_number": currentPage,
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
            const jsonResp = JSON.parse(webinarRecords);
            const webinarsMap = jsonResp.webinars.map((userObject)=> {
                let text = userObject.topic + ' (';
                if (userObject.start_time) {
                    text += userObject.start_time.substr(0, 10) + ', ';
                }
                text += 'Webinar ID ' + userObject.id + ')';
                return (
                    {
                        value: String(userObject.id),
                        text: text
                    }
                )
            }).sort((firstEl, secondEl)=> (firstEl.text > secondEl.text ? 1: -1));
            maxPage = jsonResp.page_count;
            if (currentPage > 1){
                webinarsMap.unshift({'text':'Previous Users',value:'PREVIOUS'});
            }
            if (currentPage < maxPage){
                webinarsMap.unshift({'text':'More Users',value:'MORE'});
            }
            CACHE[cache_key] = webinarsMap;
        }
        if(CACHE[error_key]){
            delete CACHE[error_key];
        }
        //Return to display
        return{
            ...previousSlotState,
            status:'VISIBLE',
            jsonSchema: {
                "title": "Select a Webinar",
                "default":"",
                "type":"string",
                "enum":CACHE[cache_key]
            }
        };
    }
    catch(ex){
        CACHE[error_key] = 'Error when loading Webinars. Please attempt to refresh.';
        return getErrorResponse(previousSlotState)
    }
    
}

function meetsDependencies(event,previousWizardState,dependencies){
    return dependencies.filter(dep => {
        const externalId = tray.env[dep.env];
        if(previousWizardState.values[externalId] == dep.value || (externalId == event.data.externalId && event.data.value == dep.value))
            return dep;
    }).length == dependencies.length;
}

function getErrorResponse(previousSlotState){
    return {
        ...previousSlotState,
        value:undefined,
        validation:{
            status:'ERROR',
            message: 'Error fetching Zoom Meetings. Please attempt to refresh.'
        },
        jsonSchema: {
            "title": "Zoom Webinars",
            "default":"",
            "type":"string",
            "enum":[{text:'Error fetching webinar records. Hit "Refresh" below to try again.',value:'ERROR'},
            {text:'Refresh',value:'REFRESH'}]
        },
        status:'VISIBLE'
    }
}