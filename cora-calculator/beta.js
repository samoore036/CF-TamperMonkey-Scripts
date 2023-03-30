// ==UserScript==
// @name         CORA TRB Tracker
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @downloadURL  https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      1.0
// @description  Display TRB status and calculate mitigation in CORA
// @author       mooshahe
// @match        https://outboundflow-iad.amazon.com/*
// @grant        GM.xmlHttpRequest
// @connect      trb-na.corp.amazon.com
// @connect      ecft.fulfillment.a2z.com
// ==/UserScript==

const alertDiv = document.getElementsByClassName('node')[0].querySelectorAll('div')[1].querySelectorAll('div')[0];
alertDiv.textContent = 'Loading...';
styleParent();
loadingStyles();


// all of the risk information for trbs
const trbData = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: 'https://trb-na.corp.amazon.com/api/statusTable',
        onreadystatechange: function(response) {
            if (response.readyState === 4 && response.status === 200) {
                resolve(this.response);
            } else {
                console.log('status table pull unsuccessful');
            }
        }
    })
});

// processing times are required to see who is actually on trb as the above api returns every site
const processingTimes = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: 'https://trb-na.corp.amazon.com/api/fcProcessingTimes',
        onreadystatechange: function(response) {
            if (response.readyState === 4 && response.status === 200) {
                resolve(this.response);
            } else {
                console.log('processing time pull unsuccessful');
            }
        }
    })
});

// pull fc list to filter for non-sortables
const fcList = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: 'https://ecft.fulfillment.a2z.com/api/NA/fc-na',
        onreadystatechange: function(response) {
            if (response.readyState === 4 && response.status === 200) {
                resolve(this.response);
            } else {
                console.log('fc list pull unsuccessful');
            }
        }
    })
});

Promise.all([trbData, processingTimes, fcList]).then(data => loadScript(data));

function loadScript(data) {
    // this div is useless so trb display/errors will go here
    const divToReplace = document.getElementsByClassName('node')[0].querySelectorAll('div')[1].querySelectorAll('div')[0];
    divToReplace.textContent = 'TRB status';
    let fc = document.URL.split('/')[3];

    if (!data[0] || !data[1] || !data[2]) {
        alertDiv.textContent = 'Content failed to load. Please refresh to try again.';
        return;
    }

    console.log(JSON.parse(data[2]));

    const nonsortables = JSON.parse(data[2])
                            .filter(site => site.fc_type.includes('Non-Sortable'))
                            .map(site => site.fc);


    loadedStyles();

    let apiData = data[0].replaceAll('[', '').replaceAll(']', '').split('{');
    const trbAllData = apiData.filter(string => string !== '').map(stringData => jsonify(stringData));
    const processTimes = JSON.parse(data[1]);
    
    /*
    the api returns trbs for all ship options but the only one we are concerned with is default shipping 
    a site is on trb if its time to cpt is greater than the process time
    only non sortables are displayed
    */
    const actualTrbs = trbAllData
                        .filter(trb => trb.shipOption === 'default')
                        .filter(trb => isOnTrb(trb.timeToCpt, processTimes[trb.fc].default))
                        .filter(trb => isNonsortable(trb.fc))
                        .sort((a,b) => a.fc > b.fc);

    alertDiv.appendChild(createTrbAlertDiv(actualTrbs));






















    /**************
     Helper Methods
    **************/
    //JSON.parse throws a syntax error so manually stringifying to turn into an object
    function stringify(str) {
        const strArr = str.split(',');
        return strArr;
    }

    //turn array of strings into an object
    function jsonify(str) {
        const strArr = stringify(str);

        let fc = beautifyString(strArr[0].split(':')[1]);
        let cpt = `${beautifyString(strArr[3].split(':')[1])}${beautifyString(strArr[4])}`
        let timeToCpt = beautifyString(strArr[9].split(':')[1]);   
        let risk = beautifyString(strArr[8].split(':')[1]);
        let shipOption = beautifyString(strArr[10].split(':')[1]);
        let packGroup = beautifyString(strArr[11].split(':')[1]).replaceAll('}', '');
        return {
            fc: fc,
            cpt: cpt,
            timeToCpt: timeToCpt,
            risk: risk,
            shipOption: shipOption,
            packGroup: packGroup
        }
    }

    // the api is a plain text file that has escape characters and quotes that need to be replaced
    function beautifyString(str) {
        if (!str) {
            return;
        }
        return str.replaceAll('"', '').replaceAll('\\', '');
    }

    // checks time to cpt against processing time. if time to cpt is greater than processing time, site is on trb
    function isOnTrb(timeToCpt, processingTime) {
        return timeToCpt > processingTime;
    }
    
    function isNonsortable(fc) {
        for (let i = 0; i < nonsortables.length; i++) {
            if (fc === nonsortables[i]) {
                return true;
            }
        }
        return false;
    }

    /**************
     Helper Methods
    **************/
   function createTrbAlertDiv(trbArray) {
    const div = document.createElement('div');
    trbArray.forEach(trb => div.appendChild(createStatusAlert(trb)));
    return div;
   }

   function createStatusAlert(trb) {
        const div = document.createElement('div');
        div.classList.add('trb-status');
        div.textContent = `${trb.fc} | ${trb.cpt} | ${trb.packGroup}`;
        return div;
   }
}

/*****
Styles
*****/
function styleParent() {
    const parent = alertDiv.parentElement;
    parent.style.cssText += parentElementStyles();
}

function parentElementStyles() {
    return `
        display: flex;
        flex-direction: column;
    `
}

function loadingStyles() {
    alertDiv.style.cssText += `
        align-self: center;
        padding: 2rem;
        font-size: 3rem;
        font-weight: bold;
    `
}

function loadedStyles() {
    alertDiv.style.cssText += `
        font-size: 1rem;
        font-weight: 400;
    `
}