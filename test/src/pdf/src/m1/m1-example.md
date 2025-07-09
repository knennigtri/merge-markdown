---
typora-copy-images-to: links
---

# <!--#--> First Module Title (H1)

This is the introduction to this module. After the introduction, there is a module table of contents that provides quick links to all topics and exercises in this module. If the student came to this module on accident, there is a secondary link "..back to the course table of contents" that lets the student go back to the global TOC.

#### Objectives (H4)

- Lorem Ipsum
  - Lorem Ipsum
- Lorem Ipsum

<!-- START auto-update -->
<!-- START doctoc -->
<!-- END doctoc -->
<!--{returnToMainTOC}-->
<!-- END auto-update -->
<div class="page-break"></div>

### List Examples (H3)

My First List

* Unordered 1
  * Unordered 2
    * Unordered 3
        * Unordered 4
* Unordered 5

My Second List

- Unordered 1
  - Unordered 2
- Unordered 3

My Third List

1. Ordered 1
   1. Ordered 2
      1. Ordered 3
      2. Ordered 4
   2. Ordered 5
2. Ordered 6

### Table, Quote, and Hyperlink Examples (H3)

[Link Example][mod1-csconfigs] are processes that run on a schedule in order to optimize the repository. With AEM as a Cloud Service, the need for customers to configure the operational properties of maintenance tasks is minimal. Customers can focus their resources on application-level concerns, leaving the infrastructure operations to Adobe. [Link Example 2][mod1-audit]

| Task                         | Owner    | How to configure (optional)                                  |
| :--------------------------- | :------- | :----------------------------------------------------------- |
| Datastore garbage collection | Adobe    | N/A - fully Adobe owned                                      |
| Version Purge                | Adobe    | Window owned by Adobe and OSGi configuration owned by customer |
| Audit Log Purge              | Adobe    | Window owned by Adobe and OSGi configuration owned by customer |
| Ad-hoc Task Purge            | Customer | Maintenance Window and OSGi Configuration                    |
| Workflow Purge               | Customer | Maintenance Window and OSGi Configuration                    |
| Project Purge                | Customer | Maintenance Window and OSGi Configuration                    |

> **NOTE** This is a very nice note.

### Code block and Code Snippet examples (H3)

OSGi confgurations allow for a maintenance task to be configured specific to the business requirements for purging content.
Code block:
`/apps/example/components  `

Code Snippet
```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:sling="http://sling.apache.org/jcr/sling/1.0" 
  xmlns:jcr="http://www.jcp.org/jcr/1.0" 
  jcr:primaryType="sling:Folder"
  sling:configCollectionInherit="true"
  sling:configPropertyInherit="true"
  windowSchedule="daily"
  windowStartTime="03:00"
  windowEndTime="05:00"
 />
```

#### Example H4
The Maintenance UI can be used to easily configure the windows on a local AEM instance and them syncronzied back into the AEM project to be checked into source control. Alternatively, you can add and edit the xml files directly.

##### Example H5

The Maintenance UI can be used to easily configure the windows on a local AEM instance and them syncronzied back into the AEM project to be checked into source control. Alternatively, you can add and edit the xml files directly.

## Exercise 1: Check each step has a Image (H2)

**Scenario**: Each step has an Image. make sure they render correctly.

Prerequisites:

- One
- Two Three

This is the beginning of the Task

1. Image with Return, tab, and < img > with zoom 15%
    <img src="../../../assets/sample-image.png" alt="sample-image" style="zoom: 15%;" />
2. Image with NO Return and < img > <img src="../../../assets/sample-image.png" alt="sample-image" />
3. Image with Return, tab, and ! [] ()
    ![sample-image](../../../assets/sample-image.png)
4. Image with NO Return and ! [] () ![sample-image](../../../assets/sample-image.png)
5. Image with Return only and < img >
<img src="../../../assets/sample-image.png" alt="sample-image" />
6. Image with 2 Returns and < img >

    <img src="../../../assets/sample-image.png" alt="sample-image" />

7. Closing Image
<img src="../../../assets/sample-image.png" alt="sample-image" />

> **Congratulations!** You have successfully created a daily purge task within a maintenance window.

## Workflow Purge Task (H2)

Minimizing the number of workflow instances increases the performance of the workflow engine, so you can regularly purge completed or running workflow instances from the repository.

Configure **Adobe Granite Workflow Purge Configuration** to purge workflow instances according their age and status. You can also purge workflow instances of all models or of a specific model .

<img src="../../../assets/sample-image.png" alt="sample-image" style="zoom: 15%;" />

You can also create multiple configurations of the service to purge workflow instances that satisfy different criteria. For example, create a configuration that purges the instances of a particular workflow model when they are running for much longer than the expected time. Create another configuration that purges all completed workflows after a certain number of days to minimize the size of the repository.

## Exercise 2: Configure a Purge Task (H2)

**Scenario:** In AEM, runtime workflow models are stored in `/var/workflows/models/`. In this exercise you will configure a workflow purge task for the Adobe provide Publish Example workflow to purge completed workflows that are older than 30 days.

**Prerequisites:**

- AEM running
- Eclipse with a Maven Project imported

#### Task 1: Create OSGi Config (H4)

1. In AEM, navigate to **Tools > Operations > Web Console**
2. In the configuration console find the **Adobe Granite Workflow Purge Configuration** factory
> **Hint** Use the browser find feature (crtl+f) to quickly find the configuration

> **Note** a factory configuration means you can have multiple instances of the configuration

3. Click on the the configuration factory and observe the different options of the configuration:

|          Option Name          |          Description           |
| :---------------------------: | :----------------------------: |
|      scheduledpurge.name      | Name that shows up in the logs |
| scheduledpurge.workflowStatus |       COMPLETED/RUNNING        |
|    scheduledpurge.modelIds    |    List of models to purge     |
|    scheduledpurge.daysold     |     Age of models to purge     |

> **Note** The Factory Persistance Identity (PID) will also be needed to create the json config file.

4. Keep this browser window open to observe the configuration file against these configurations.

5. Open your project in Eclipse.
6. Since configurations are considered immutable content, navigate to **devops.ui.apps > src/main/content/jcr_root > apps > training**

7. Right click on **config.author** and select **New > File**

8. Enter **com.adobe.granite.workflow.purge.Scheduler~training.cfg.json** as the file name and click **Finish.**

9. The file will open in the editor. In the **Exercise Files**, navigate to **training-files/Maintenanc**e and copy the contents of **com.adobe.granite.workflow.purge.Scheduler~training.cfg.json**

   > **Note** This purge task has **daysold** set to 0 to show the purge task successfully running in the next task.

10. Verify the file contents verify against the configuration in the web console in the browser. **Save** your changes in the Eclipse editor.

#### Task 2: Install and verify the purge configuration (H4)

1. In the Project Explorer, right-click **devops-training** and select **Run As > Maven Build**. The build starts.
2. Verify that the build completed successfully
3. In AEM, navigate to **Tools > Operations > Web Console**
4. In the configuration console find the **Adobe Granite Workflow Purge Configuration** factory. There should now be an instance of the factory called **com.adobe.granite.workflow.purge.Scheduler~training**. Open it.
5. Notice the configurations you added to the JSON file are now properly configured.
6. To observe the purge task successfully running, you will need to complete a Publish Example workflow. Navigate to the **Sites Console**
7. Select **WKND Site > Create > Workflow**
   1. Workflow model = Publish Example
   2. Workflow Title = Publish WKND
   3. Select **Next**
   4. Select **Create**
8. The workflow has successfully started. To complete the workflow, Go to the **Inbox** in the top right corner (bell icon) and click **View all**.
9. Select the work item, **Validate Content** and click **Complete**.
10. Click **Ok** in the popup to complete the work item. The page publishes and the workflow is complete.
11. Verify the Completed workflow by going to **Tools > Workflow > Archive**. Observe the completed workflow.
12. You can manually kick off maintenance tasks outside the normal maintenance window for testing purposes. Navigate to **Tools > Operations > Maintenance**
13. Click on **Weekly Maintenance Window**. On the **Workflow Purge** card, click the **play** button.
14. You will see the card go from yellow to green when the task is complete. To verify the purge successfully occurred, navigate back to  **Tools > Workflow > Archive** and notice the archived Publish Example workflow instance no longer exists.

> **Congratulations!** You have successfully configured a purge task and tested it successfully.

## Exercise 3: Create a Monthy Window (H2)
**Scenario:** Your company has started using ad-hoc tasks and you want to make sure older tasks are properly removed from the system. This is not a widely used feature and purging old tasks is not top priority. You want to create a monthly maintenance window to purge any tasks out of compliance with the out of the box ad-hoc task purge configuration. This configuration purges completed tasks older than 30 days and active tasks older than 90 days. See ` com.adobe.granite.taskmanagement.impl.purge.TaskPurgeMaintenanceTask` in the web console.

Prerequisites:

- AEM running


1. In AEM, Navigate to **Tools > General > CRXDE Lite**
2. In the JCR tree on the left, navigate to **/libs/settings/granite/operations/maintenance**
3. Copy the **granite_weekly** node and paste it under **/conf/global/settings/granite/operations/maintenance**
4. Save.
5. Under **/conf/global/settings/granite/operations/maintenance** delete the 3 nodes under **granite_weekly** and **Save**.
6. Rename **granite_weekly** to **granite_monthly** and **Save**
7. Select **granite_monthly** and in the properties pane on the bottom right, update the **windowSchedule** to **monthy** and **Save**.
8. At this point we can use the Maintenance UI to complete the window. In AEM, navigate to **Tools > Operations > Maintenance**
9. Hover over **Monthly Maintenance Window** and click the **Configure gears.**
10. Change the start and end days to **Friday** and **Save**
11. Click on the **Monthly Maintenance Window** to open it.
12. Click the **Add** icon. 
13. Select **Purge of ad-hoc tasks** and **Save**.

> **Congratulations**! You have successfully added the ad-hoc purge task to a monthly maintenance window.

[mod1-csconfigs]: https://docs.adobe.com/content/help/en/experience-manager-cloud-service/operations/maintenance.html
[mod1-audit]: https://docs.adobe.com/content/help/en/experience-manager-65/administering/operations/operations-audit-log.html
