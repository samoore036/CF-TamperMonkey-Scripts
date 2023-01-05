This script is designed to increase visibility of dwells per CPT for Central Flow leads and AMs/PAs on site. The intent of this script is to replace the dwell dashboard to reduce load times and reliance on excels (at Central Flow we often have 2+ other excels with heavy macros open at a time).

**Please note: This script is to be used with Firefox. You must have the tampermonkey extension installed in order to use this.**

**How it works**:

The script will pull every shipment row displayed for the cpt. If there are multiple pages, it only pulls for the first page. Max on a page is 1,000.
The script will organize shipments by pack group: singles, multis, bod/non/handtape/others, HOV, and scanned.
Within each table, cages are by default organized by quantity. After speaking to multiple PAs, this seems to be the most value-added call out when calling out dwelling cages.
However, you can change the sortation method to dwell time if you wish.

**Filters:**
Currently any cage dwelling less than 60 minutes in PPIP, less than 50 minutes in PPIT, less than 20 minutes in PPAD, and less than 30 minutes in RebinBuffered, Sorted, or Scanned will not be displayed.
This is to ensure that there is visibility on cages that have been dwelling for a more than reasonable period of time.
If you feel that these filters are too short or too long, please message me at mooshahe so I can adjust them.

**Installation:**
1. Click on cpt-dwell.js to open the link
  
2. Click on Raw
  ![image](https://user-images.githubusercontent.com/104536361/210673512-10783975-3054-4d4e-ae44-e36addaf47a2.png)

3. A new tab will open with all of the code. Ctrl + A to select all. Ctrl + C to copy all of it
  ![image](https://user-images.githubusercontent.com/104536361/210673668-3b1a6f73-0b20-49cf-bcf1-e3e9b73aedbb.png)

4. Once you have tampermoney installed, click on the binoculars icon and select Create a new script
  ![image](https://user-images.githubusercontent.com/104536361/210673751-d556a76d-7dfc-4bc6-9073-f7b1d49bb1c9.png)

5. Ctrl + A to select what is there. Delete all of it. Ctrl + P to paste in the script from step 3
![image](https://user-images.githubusercontent.com/104536361/210673846-1b14a258-8749-46a3-bafc-e4f43e6fc79f.png)
![image](https://user-images.githubusercontent.com/104536361/210673861-3509d7ec-cb12-4c1e-a10e-38ce36415d07.png)
![image](https://user-images.githubusercontent.com/104536361/210673931-c3297a44-6c41-4716-938b-db5a96e94b9d.png)

6. Press Ctrl + S to save. Now navigate to any rodeo link. Click on a cpt. Under the options tab **select only outer scannable id and last ExSD**
  ![image](https://user-images.githubusercontent.com/104536361/210674065-a44ec4af-e29b-4666-a4de-4ab8fec59e81.png)

7. Save as default so that you do not have to change these settings every time.

8. Reload the page and it will start working. **Please note you must change these options and save as default for every fc's rodeo**
  ![image](https://user-images.githubusercontent.com/104536361/210674186-79d1ee96-f55a-48b7-9397-ab38a2260bf0.png)



