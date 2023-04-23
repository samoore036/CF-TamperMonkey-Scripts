// ==UserScript==
// @name         cpt puller
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/tree/main/cpt%20puller
// @downloadURL  https://github.com/samoore036/CF-TamperMonkey-Scripts/tree/main/cpt%20puller
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      2.0
// @description  Display TRB status and calculate mitigation in CORA
// @author       mooshahe
// @match        https://rodeo-iad.amazon.com/*/ExSD*
// @grant        GM.xmlHttpRequest
// @connect      ecft.fulfillment.a2z.com
// ==/UserScript==

const fc = document.URL.split('/')[3];
let currentSLA = '';
loadElements();

// boolean flag used to check if timer is running
let isRunning = false;

// check if the slam pad time is stored in local storage. if not then prompt user to enter a slam pad time
// keys are stored as fc and values are the slam pad time in minutes
if (!localStorage.getItem(`${fc}`)) {
    openSLAModal();
} else {
    checkForCpts();
}

/* 
this is the main function of the script that will check every second until the minute 
when it is time to pull the cpt. It will auto download the csv for the cpt when the time 
reaches the slam pad time for that cpt. this is accomplished by identifying the next
cpt with slam pad time. once the times align, window.open() will be called on the 
link to the csvfor download
*/
function checkForCpts() {    
    if (isRunning) {
        return;
    }
    isRunning = true;
    // set the interval in a variable in order to clear it. clearInterval needs an id to work
    const check = setInterval(() => {
        const cptInfo = getNextCpt();
        const timeNow = cptInfo[0];
        const nextCpt = cptInfo[1]
        const rangeOne = cptInfo[2];
        const rangeTwo = cptInfo[3];
        
        console.log(`time with sla and any timezone offset: ${timeNow}`);
        console.log(`next cpt: ${nextCpt}`);
        /* 
        in order to pull correct misses, link must include all units remaining for process paths listed. 
        to remedy this, i opted to include every CE path listed in the USNS CF wiki. tested to be working
        */
        const link = `https://rodeo-iad.amazon.com/${fc}/ItemListCSV?_enabledColumns=on&WorkPool=PredictedCharge%2CPlannedShipment%2CReadyToPick%2CReadyToPickHardCapped%2CReadyToPickUnconstrained%2CPickingNotYetPicked%2CPickingNotYetPickedPrioritized%2CPickingNotYetPickedNotPrioritized%2CPickingNotYetPickedHardCapped%2CCrossdockNotYetPicked%2CPickingPicked%2CPickingPickedInProgress%2CPickingPickedInTransit%2CPickingPickedRouting%2CPickingPickedAtDestination%2CInducted%2CRebinBuffered%2CSorted%2CGiftWrap%2CPacking%2CScanned%2CProblemSolving%2CProcessPartial%2CSoftwareException%2CCrossdock%2CPreSort%2CTransshipSorted%2CPalletized&enabledColumns=LAST_EXSD&enabledColumns=OUTER_SCANNABLE_ID&ExSDRange.RangeStartMillis=${rangeOne}&ExSDRange.RangeEndMillis=${rangeTwo}&Fracs=NON_FRACS&ProcessPath=PPSingleMCF%2CPPHOVBOD%2CPPSingleOPNonCon%2CPPSingleFloor%2CPPSingleFloorBOD%2CPPSingleFloorNonCon%2CPPSingleFloorDG%2CPPSingleFloorHandTape%2CPPSingleFloorMCF%2CPPSingleFloorNonAuto%2CPPSingleFloorSIOC%2CPPSingleFloorWeights%2CPPHOVNonCon%2CPPHOVBox%2CPPHOVHeavy%2CPPHOVNonAuto%2CPPHOVSIOC%2CPPHOVSingle%2CPPHOVTeamLift%2CPPMultiBldgWide%2CPPMultiBldgWideOPVNA%2CPPMultiBldgWideOP%2CPPMultiWrap%2CPPMultiDG%2CPPMultiCASEPallet%2CPPSingleOP%2CPPSingleOPHandTape%2CPPSingleOPNonAuto%2CPPSingleOPVNA%2CPPHOVAuto%2CPPSingleOPBOD%2CPPSingleOPDG%2CPPMultiMCF%2CPPHOVAutoL%2CPPSingleOPNonConLong%2CPPSingleOPVNASIOC%2CPPSingleOPWeights%2CPPSingleTeamLift%2CPPMultiFloor&shipmentType=CUSTOMER_SHIPMENTS`;
        if (timeNow.getTime() == nextCpt.getTime()) {
            // the fetch below is needed to convert the generic file name (shipmentlist) into a custom one using blobs
            fetch(link) 
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `${fc} ${nextCpt.getHours()}${nextCpt.getMinutes() === 0 ? '00' : nextCpt.getMinutes()} ${timeNow.getFullYear()}-${timeNow.getMonth() + 1}-${timeNow.getDate()}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            }).catch(() => console.log('failed to download'));
            // after link downloads pause timer for 1 minute so file does not auto download every second
            isRunning = false;
            clearInterval(check);
            console.log('csv pulled, pausing for 1 minute')
            window.setTimeout(() => {
              checkForCpts();  
            }, 60000);
        }
    }, 30000);
}

// need to find next cpt by parsing the tds at the top and finding the next one, accounting for the next day as well
function getNextCpt() {
    // first find the index of first cpt which is one after range total
    const tds = Array.from(document.getElementsByClassName('header-row')[0].querySelectorAll('th'));
    const cpts = tds.map(td => td.innerHTML.trim().replaceAll(' ', "").replaceAll('\n', '').replaceAll('>', '-').replaceAll('<', '-'));
    let index = -1;
    for (let i = 0; i < cpts.length; i++) {
        if (cpts[i].trim().includes('Range')) {
            index = i + 1;
            break;
        }
    }

    cpts.splice(0, index);
    // set new array length to prevent having to parse a lot of td's
    cpts.length = tds.length < 15 ? tds.length : 15;

    // compare curr hour against cpts with tds array. keep looping until curr hour < tds array
    const timeNow = new Date();
    // include the offset so the pull will be accurate regardless of user's  current timezone
    const hourOffset = getHourOffset(getFcTimeZone(fc), getTimeZoneOffset());
    // new date to set seconds to zero for better comparison
    const currTime = new Date(timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate(), timeNow.getHours() + hourOffset, timeNow.getMinutes());
    // add slam pad time 
    const timeWithSLA = new Date();
    timeWithSLA.setTime(currTime.getTime() + (parseInt(localStorage.getItem(`${fc}`)) * 60000));
    let nextCpt = '';
    const dates = extractDateArray(cpts);
    for (let i = 0; i < dates.length; i++) {
        if (timeWithSLA <= dates[i]) {
            nextCpt = dates[i];
            break;
        }
    }
    
    // return the index, current time with SLA, next cpt time, as well as the times needed to get the right link 
    // Date.parse returns UTC in time zone so must account for offset in this as well
    return [timeWithSLA, nextCpt, (Date.parse(nextCpt) - 1) + getUtcOffset(hourOffset), (Date.parse(nextCpt) + 60000) + getUtcOffset(hourOffset)];
}

/* DOM helper methods */
function loadElements() {
    document.body.appendChild(makeModal());
    const parent = document.getElementsByClassName('rodeo-navigation-links')[0];
    parent.style.display = 'flex';
    parent.appendChild(makeSLABar());
}

function openSLAModal() {
    const modal = document.getElementById('modal');
    modal.style.zIndex = '1000';
    modal.style.position = 'fixed';
    modal.style.top = '30%';
    modal.style.left = '35%';
    modal.style.width = '30vw';
    modal.style.height = '40vh';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.justifyContent = 'center';
    modal.style.padding = '3rem';
    modal.style.color = 'white';

    const slaDiv = document.getElementById('sla-div');
    slaDiv.remove();
}

function closeSLAModal(e) {
    const parentElement = e.target.parentElement;

    // prompt user if input is invalid 
    if (currentSLA.length !== 0 ) {
        if (isNaN(currentSLA)) {
            const errorMessage = document.createElement('p');
            errorMessage.textContent = 'Please enter a valid number.'
            errorMessage.style.cssText += `
                color: red; font-weight:bold;
                position: absolute; bottom: 1vw; text-align: center;
                margin: auto; left: 0; right: 0;
            `
            parentElement.appendChild(errorMessage);
            return;
        }
    } 
    
    // if it all checks out and a number was input, update local storage
    if (!isNaN(currentSLA) && currentSLA.length !== 0) {
        localStorage.setItem(`${fc}`, currentSLA);
    }
    
    parentElement.style.display = 'none';

    const parent = document.getElementsByClassName('rodeo-navigation-links')[0];
    parent.style.display = 'flex';
    parent.appendChild(makeSLABar());

    checkForCpts();
}

function extractDateArray(cpts) {
    // filter out the case where the cpt is 'Later Total' as this will throw an error
    const dates = cpts.filter(cpt => !cpt.includes('Later')).map(cpt => {
        const strings = cpt.split('-');
        const dateString = strings[3];
        // extract month from date
        let breakIndex = -1;
        for (let i = 0; i < dateString.length; i++) {
            if (!isNaN(dateString[i])) {
                breakIndex = i;
                break;
            }
        }
        const month = getMonthIndex(dateString.substring(0, breakIndex));
        const day = dateString.substring(breakIndex, dateString.length);
        const hour = strings[7].split(':')[0];
        const minutes = strings[7].split(':')[1];
        // account for turn of the year
        const year = month === 0 && new Date().getMonthIndex === 12 ? new Date().getFullYear() + 1 : new Date().getFullYear();
        
        return new Date(year, month, day, hour, minutes);
    })

    return dates;
}

// js month index starts at 0 for jan. i made this in april so no idea how rodeo does all months
function getMonthIndex(month) {
    switch(true) {
        case month.includes('Jan'): return 0;
        case month.includes('Feb'): return 1;
        case month.includes('Mar'): return 2;
        case month.includes('Apr'): return 3;
        case month.includes('May'): return 4;
        case month.includes('Jun'): return 5;
        case month.includes('Jul'): return 6;
        case month.includes('Aug'): return 7;
        case month.includes('Sep'): return 8;
        case month.includes('Oct'): return 9;
        case month.includes('Nov'): return 10;
        case month.includes('Dec'): return 11;
    } 
}

function getHourOffset(fcOffset, timeOffset) {
    return fcOffset - timeOffset;
}

// returns the timezone offset to calculate the total time offset 
function getTimeZoneOffset() {
    const utcOffset = new Date().getTimezoneOffset();
    switch(utcOffset) {
        case 420: return 0;
        case 360: return 1;
        case 300: return 2;
        case 240: return 3;
    }
}

// one hour in utc is 3.6 million
// from testing if site is ahead in time subtract and if you are ahead of site add
function getUtcOffset(hourOffset) {
    return -1 * (hourOffset * 3600000);
}

// have all timezones for all USNS in case user is pulling for a timezone different than on device
// pst returns 0, mst 1, cst 2, est 3
function getFcTimeZone(fc) {
    switch(fc) {
        case 'BFI3':
        case 'FAT2':
        case 'GEG2':
        case 'LAS6':
        case 'LGB4':
        case 'LGB6':
        case 'MCE1':
        case 'OAK3':
        case 'ONT9':
        case 'PDX7':
        case 'PHX5':
        case 'PHX7':
        case 'RNO4':
        case 'SBD2':
        case 'SCK1':
        case 'SJC7':
        case 'SMF6':
        case 'SNA4':
        case 'YVR3':
            return 0;
        case 'DEN2':
        case 'DEN8':
        case 'SLC2':
        case 'YEG1':
        case 'YYZ9':
            return 1;
        case 'BNA2':
        case 'DFW6':
        case 'FAR1':
        case 'FOE1':
        case 'FTW5':
        case 'HOU3':
        case 'HOU8':
        case 'HSV1':
        case 'ICT2':
        case 'IGQ2':
        case 'JVL1':
        case 'LFT1':
        case 'LIT2':
        case 'MDW6':
        case 'MDW9':
        case 'MEM6':
        case 'MEX3':
        case 'MKC4':
        case 'OKC2':
        case 'ORD2':
        case 'SAT1':
        case 'SAT4':
        case 'STL3':
        case 'STL4':
            return 2;
        case 'ABE4':
        case 'ACY2':
        case 'ALB1':
        case 'BOS7':
        case 'BWI4':
        case 'CHA2':
        case 'CLT3':
        case 'CMH2':
        case 'CMH3':
        case 'DCA6':
        case 'DET1':
        case 'DET2':
        case 'GSO1':
        case 'GSP1':
        case 'ILG1':
        case 'IND2':
        case 'IND5':
        case 'JAX3':
        case 'MCO2':
        case 'MDT1':
        case 'MGE3':
        case 'PHL4':
        case 'PHL5':
        case 'PHL6':
        case 'PIT2':
        case 'RIC1':
        case 'SAV3':
        case 'SWF1':
        case 'TEB3':
        case 'TEB4':
        case 'TEB6':
        case 'TPA2':
        case 'TPA3':
        case 'YOO1':
        case 'YOW1':
        case 'YYZ2':
        case 'YYZ3':
            return 3;
    }
}

/* DOM modules */
function makeModal() {
    const modal = document.createElement('div');
    modal.setAttribute('id', 'modal');
    // modal.style.display = 'none';

    const prompt = document.createElement('p');
    prompt.textContent = `Please enter slam pad time for ${fc} in minutes. This can be changed at any time.`
    prompt.style.textAlign = 'center';
    modal.appendChild(prompt);

    const input = document.createElement('input');
    input.addEventListener('input', () => {
        currentSLA = input.value;
    })
    modal.appendChild(input);

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.addEventListener('click', closeSLAModal);
    modal.appendChild(saveButton);
    
    return modal;
}

function makeSLABar() {
    const slaDiv = document.createElement('div');
    slaDiv.setAttribute('id', 'sla-div');
    slaDiv.style.display = 'flex';
    slaDiv.style.gap = '5px';
    slaDiv.style.marginLeft = '4vw';

    const message = document.createElement('p');
    message.textContent = `Current SLA is ${localStorage.getItem(`${fc}`)} minutes`;
    message.style.backgroundColor = '#fdba74';
    message.style.border = '2px solid #fb923c';
    message.style.fontSize = '0.9rem';
    message.style.padding = '0.3rem';
    slaDiv.appendChild(message);

    const changeButton = document.createElement('button');
    changeButton.textContent = 'change';
    changeButton.style.cssText += `
        display: flex; align-items: center;
        height: 80%; 
    `
    changeButton.addEventListener('click', openSLAModal);
    slaDiv.appendChild(changeButton);

    return slaDiv;
}