// ==UserScript==
// @name         HC Tracker
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @downloadURL  https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      1.1.0
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

    const packHeadcounts = {
        singles: 0,
        multis: 0,
        bod: 0,
        slap: 0,
        handTape: 0
    }

    parseData(getPackData());

    makeDivs();
    loadPackTableData();

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
                    packHeadcounts.slap++;
                    continue;
                }
                if (workStation.includes('BOD')) {
                    packHeadcounts.bod++;
                    continue;
                }
                packHeadcounts.singles++;
            }
            if (processPath.includes('Single') && !processPath.includes('BOD') && !processPath.includes('NonCon') && !processPath.includes('SIOC') && !processPath.includes('HandTape')) {
                packHeadcounts.singles++;
            }
            if (processPath.includes('Multi')) {
                packHeadcounts.multis++;
            }
            if (processPath.includes('NonCon')) {
                packHeadcounts.slap++;
            }
            if (processPath.includes('HandTape')) {
                packHeadcounts.handTape++;
            }
            if (processPath.includes('BOD')) {
                packHeadcounts.bod++;
            }
            if (processPath.includes('HOV')) {
                if (packMode.includes('singles')) {
                    packHeadcounts.singles++;
                } else if (packMode.includes('singles_slam') && workStation.includes('BOD')) {
                    packHeadcounts.bod++;
                } else {
                    packHeadcounts.slap++;
                }
            }
        }
    }

    function makeDivs() {
        const parentDiv = document.getElementsByClassName('mat-tab-body-content')[0];
        const masterDiv = makeMasterDiv();
        parentDiv.appendChild(masterDiv);

        const pickDiv = makePickDiv();
        masterDiv.appendChild(pickDiv);

        const packDiv = makePackDiv();
        const packTable = makePackTable();

        packDiv.appendChild(packTable);
        masterDiv.appendChild(packTable);

        parentDiv.prepend(masterDiv);
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

    function makeMasterDiv() {
        const masterDiv = document.createElement('div');

        return masterDiv;
    }

    function makePickDiv() {
        const pickDiv = document.createElement('div');

        return pickDiv;
    }

    function makePackDiv() {
        const packDiv = document.createElement('div');

        return packDiv;
    }

    function makePackTable() {
        const packTable = document.createElement('table');
        packTable.setAttribute('id', 'pack-table');
        const titleRow = document.createElement('tr');
        titleRow.style.fontSize = '2rem';
        titleRow.style.color = 'white';
        titleRow.style.backgroundColor = '#3b82f6';
        titleRow.style.border = '1px solid black';
        titleRow.style.borderBottom = 'none';
        const titleHeader = document.createElement('th');
        titleHeader.classList.add('table-header');
        titleHeader.textContent = `Pack hcs in the last ${localStorage.getItem('time-pref')} minutes`;
        titleHeader.colSpan = '11';
        titleRow.appendChild(titleHeader);
        packTable.appendChild(titleRow);

        const categoriesRow = document.createElement('tr');
        categoriesRow.style.fontSize = '1.5rem';
        categoriesRow.style.color = 'white';
        categoriesRow.style.backgroundColor = '#3b82f6';
        categoriesRow.style.borderLeft = '1px solid black';
        categoriesRow.style.borderRight = '1px solid black';

        const td1 = makeHeaderTd('Pack Group');
        categoriesRow.appendChild(td1);
        const td2 = makeHeaderTd('Active Packers');
        td2.title = 'Detected using the below pack data';
        td2.style.cursor = 'help';
        categoriesRow.appendChild(td2);
        const td3 = makeHeaderTd('Planned Packers');
        categoriesRow.appendChild(td3);
        const td4 = makeHeaderTd('Delta');
        categoriesRow.appendChild(td4);
        const td5 = makeHeaderTd('Deviation');
        categoriesRow.appendChild(td5);
        packTable.appendChild(categoriesRow);

        return packTable;
    }

    function loadPackTableData() {
        const packTable = document.getElementById('pack-table');
        for (const [key, value] of Object.entries(packHeadcounts)) {
            if (!value || value === 0) {
                continue;
            }
            const tr = makePackTableRow(key, value);
            packTable.appendChild(tr);
        }
    }

    function makePackTableRow(packGroup, hc) {
        const tr = document.createElement('tr');
        const name = makeTd(packGroup);
        tr.appendChild(name);

        const activePackersTd = makeTd(hc);
        tr.appendChild(activePackersTd);

        let plannedPackers = 0;
        if (localStorage.getItem(`${fc}-${packGroup}`)) {
            plannedPackers = localStorage.getItem(`${fc}-${packGroup}`);
        }

        const plannedPackersTd = makeInputTd(packGroup);
        tr.appendChild(plannedPackersTd);

        const delta = hc - plannedPackers;
        const deltaTd = makeTd(delta);
        deltaTd.style.backgroundColor = delta === 0 ? '#22c55e' : '#f87171';
        tr.appendChild(deltaTd);

        const deviationPercent = getDeviationPercent(hc, plannedPackers);
        const deviationTd = makeTd(deviationPercent);
        tr.appendChild(deviationTd);

        return tr;
    }

    function makeTd(data) {
        const td = document.createElement('td');
        td.textContent = data;

        return td;
    }

    // use local storage to load in saved plan pack hc so don't have to reenter upon refresh
    // if no local storage for that pack group exists, use 0
    // when user changes the input, automatically save new input in local storage
    // the key is saved as fc-packGroup as leads run multiple sites
    function makeInputTd(packGroup) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        if (localStorage.getItem(`${fc}-${packGroup}`)) {
            input.value = localStorage.getItem(`${fc}-${packGroup}`);
        } else {
            input.value = 0;
        }

        input.addEventListener('change', (e) => {
            localStorage.setItem(`${fc}-${packGroup}`, e.target.value);
        })
        td.appendChild(input);

        return td;
    }

    function makeHeaderTd(str) {
        const td = document.createElement('td');
        td.classList.add('header-td');
        td.textContent = str;
        return td;
    }

    function getDeviationPercent(activePackers, plannedPackers) {
        if (activePackers == 0) {
            return '100%';
        }
        const deviationPercent = ((plannedPackers - activePackers) / plannedPackers) * 100 * -1;
        return `${deviationPercent > 0 ? '+' : ''}${deviationPercent.toFixed(0)}%`;
    }
}


/* to dos
make div table for pack hcs
display pick table
add flags if noncon processed in BOD or vice versa


*/
