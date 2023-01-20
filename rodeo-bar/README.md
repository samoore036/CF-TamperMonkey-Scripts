

This script is designed to increase visibility of useful metrics for Central Flow leads and AMs/PAs on site. The script will display WIP (work in progress), pickable, psolve bucket, and scanned bucket totals.

Please note: This script is to be used with Firefox. You must have the tampermonkey extension installed in order to use this. Additionally, this only works for rodeo pages organized by work pool THEN process path (not process path THEN work pool).

Special thank you to Carlos Hernandez (carlhrn, https://github.com/MochaKnight) for helping to develop this script.

How it works:

The script will make a display bar at the top of rodeo utilizing the work pools displayed on the main rodeo page to summarize WIP, pickable, psolve and scanned buckets.

WIP (work in progress) is defined as anything that has been picked, but has not been packed. Therefore, wip is picking picked + rebin buffered + sorted. If using with an ARNS site, induct is also added to this total.
Pickable is calculated as RTP total + PNYP total - RTP nonpickable - PNYP nonpickable.
Per CF standards, the scanned threshold is 500/1000 for TNS/ARNS and the psolve threshold is 50/100 for TNS/ARNS. These buckets will display as green until they hit 80% (scanned 400/800, psolve 40/80) of the threshold. They will turn red at 100% of the threshold.

Installation:

    Click on rodeo-bar.js to open the link

    Click on Raw 
    ![image](https://user-images.githubusercontent.com/104536361/213764886-0eba5c8d-a53b-4b32-8537-78be7b9e6328.png)
    
    A new tab will open with all of the code. Ctrl + A to select all. Ctrl + C to copy all of it image
    
    ![image](https://user-images.githubusercontent.com/104536361/213764952-27d65361-19fe-4ceb-a5a6-095729f14bce.png)

    Once you have tampermonkey installed, click on the binoculars icon and select Create a new script 
    
    ![image](https://user-images.githubusercontent.com/104536361/213765004-aec9bb0d-9381-4fa5-92af-95e3968387d1.png)

    Ctrl + A to select what is there. Delete all of it. Ctrl + P to paste in the script from step 3 
    
    ![image](https://user-images.githubusercontent.com/104536361/213765080-06843582-7cdb-42a4-8955-07a406f5fa99.png)
    
    ![image](https://user-images.githubusercontent.com/104536361/213765137-b655eb45-bb20-4e3b-bf26-34cc06375042.png)
    
    ![image](https://user-images.githubusercontent.com/104536361/213765331-1b901dfb-1856-4fb9-8912-bb61a55e097e.png)

    Press Ctrl + S to save
    
    Reload the page and it will start working. Enjoy!
    
    ![image](https://user-images.githubusercontent.com/104536361/213765976-41333694-8050-4515-8eb3-ab00b1892803.png)

    ![image](https://user-images.githubusercontent.com/104536361/213765643-bd50cddd-f577-4ab6-bdc7-33720e53cd7b.png)
    

