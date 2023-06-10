// ==UserScript==
// @name         HC Tracker
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @downloadURL  https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      1.0.2
// @description  Display all pick settings, including hcs, and pack hcs
// @author       mooshahe
// @match        https://insights.prod-na.pack.aft.a2z.com/packman/recent?fc=*
// @grant        GM.xmlHttpRequest
// @connect      process-path.na.picking.aft.a2z.com
// @connect      insights.prod-na.pack.aft.a2z.com
// @connect      picking-console.na.picking.aft.a2z.com
// ==/UserScript==

/*
ready state changes do not work at all, neither does window/document.loaded.
fc console is dynamically generated so must wait until it is completely loaded
*/

let fc = document.URL.split('=')[1];

//three requests to be made: get active process path data, get set process path data and get active batches
const activeData = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: `https://picking-console.na.picking.aft.a2z.com/api/fcs/${fc}/process-paths/information`,
        onreadystatechange: function(response) {
            if (response.readyState == 4 && response.status == 200) {
                resolve(this.response);
            } else {
                console.log('did not get active data');
            }
        }
    })
})

const setData = new Promise(function(resolve) {
        GM.xmlHttpRequest({
            method: "GET",
            url: `https://process-path.na.picking.aft.a2z.com/api/processpath/${fc}/processPathWithUserSettingsList`,
            onreadystatechange: function(response) {
                if (response.readyState == 4 && response.status == 200) {
                    resolve(this.response);
                }  else {
                    console.log('did not get set data');
                }
            }
        })
});

const batchData = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: `https://picking-console.na.picking.aft.a2z.com/api/fcs/${fc}/batch-info/Active`,
        onreadystatechange: function(response) {
            if (response.readyState == 4 && response.status == 200) {
                resolve(this.response);
            }  else {
                console.log('did not get active batch data');
            }
        }
    })
})

// packman grabs it's own apis and loads dom, so must wait for these to load before executing script
//after data is retrieved for set process paths, get active batch data, then wait until DOM is loaded then execute script
Promise.all([activeData, setData, batchData]).then((data) => {
    setTimeout(() => {
        loadScript(data);
    }, 4000);
})

function loadScript(data) {
    const activeData = JSON.parse(data[0]).processPathInformationMap;
    const setData = JSON.parse(data[1]).processPaths; //gives an array of all process paths with set settings
    const batchData = JSON.parse(data[2]).pickBatchInformationList;

    // console.log(activeData);
    // console.log(setData);
    // console.log(batchData);

    // if no localStorage yet, default to 15
    if (!localStorage.getItem('time-pref')) {
        localStorage.setItem('time-pref', '15');
    }

    let singles = 0;
    let multis = 0;
    let slap = 0;
    let handTape = 0;
    let bod = 0;

    parseData(getPackData());

    const parentDiv = document.getElementsByClassName('mat-tab-body-content')[0];
    const div = document.createElement('div');
    div.textContent = `singles: ${singles}, multis: ${multis}, slap: ${slap}, bod: ${bod} `;
    if (handTape > 0) {
        div.textContent += `handtape: ${handTape}`;
    }
    parentDiv.prepend(div);

    // there is no get api so must iterate over the DOM and create an object with each packer's information to then parse
    // default timeFrame is 15 minutes, but user can change this and store as a cookie

    // main methods
    function getPackData() {
        const packData = [];

        const rows = Array.from(document.querySelector('tbody').querySelectorAll('tr'));
        for (let i = 0; i < rows.length; i++) {
            // filter out if start time is greater than time pref
            const startTime = rows[i].querySelectorAll('td')[2].textContent;
            if (!isWithinTimePref(startTime)) {
                console.log('not in time pref');
                continue;
            } else {
                console.log('within time pref');
                packData.push({
                    workStation: rows[i].querySelectorAll('td')[5].textContent.trim(),
                    packMode: rows[i].querySelectorAll('td')[6].textContent.trim(),
                    processPath: rows[i].querySelectorAll('td')[7].textContent.trim()
                })

            }
        }

        return packData;
    }

    function parseData(packData) {
        for (let i = 0; i < packData.length; i++) {
            // if ((packData[i].processPath.includes('Single') || packData[i].processPath.includes('HOV')) && (packData[i].workStation.includes('wsPack') || packData[i].workStation.includes('wsGW'))) {
            //     singles++;
            //     continue;
            // }
            // if (packData[i].packMode === 'rebin') {
            //     multis++;
            //     continue;
            // }
            // if (packData[i].workStation.match('ws[0-9]+') || (packData[i].workStation.includes('BOD') && packData[i].processPath.includes('NonCon'))) {
            //     slap++;
            //     continue;
            // }
            // if (packData[i].processPath.includes('HandTape') && packData[i].workStation.includes('wsBOD')) {
            //     handTape++;
            //     continue;
            // }
            // if (packData[i].workStation.includes('wsBOD')) {
            //     bod++;
            // }
            const { processPath, packMode, workStation } = packData[i];
            // skip psolve
            if (workStation.includes('POPS' || workStation.includes('pops'))) {
                continue;
            }
            if (processPath.includes('MCF')) {
                if (packMode.includes('singles_slam')) {
                    slap++;
                    continue;
                }
                if (workStation.includes('BOD')) {
                    bod++;
                    continue;
                }
                singles++;
            }
            if (processPath.includes('Single') && !processPath.includes('BOD') && !processPath.includes('NonCon') && !processPath.includes('SIOC') && !processPath.includes('HandTape')) {
                singles++;
            }
            if (processPath.includes('Multi')) {
                multis++;
            }
            if (processPath.includes('NonCon')) {
                slap++;
            }
            if (processPath.includes('HandTape')) {
                handTape++;
            }
            if (processPath.includes('BOD')) {
                bod++;
            }
            if (processPath.includes('HOV')) {
                if (packMode.includes('singles')) {
                    singles++;
                } else if (packMode.includes('singles_slam') && workStation.includes('BOD')) {
                    bod++;
                } else {
                    slap++;
                }
            }
        }
    }



    // helper methods
    function isWithinTimePref(startTime) {
        // convert to date object for comparison
        const pieces = startTime.trim().split(' ');
        const year = pieces[2];
        const month = pieces[0];
        const day = pieces[1];
        const am = pieces[4] === 'AM' ? true : false;
        const timeString = pieces[3].split(':');
        const hour = am ? timeString[0] : parseInt(timeString[0]) + 12;
        const minute = timeString[1];
        const second = timeString[2];
        
        const startTimeObj = new Date(`${month} ${day}, ${year} ${hour}:${minute}:${second}`);
        
        let timeNowWithTimePref = new Date();
        let newMinutes = timeNowWithTimePref.getMinutes() - localStorage.getItem('time-pref');
        timeNowWithTimePref.setMinutes(newMinutes);

        return timeNowWithTimePref > startTimeObj ? false : true;
    }
}