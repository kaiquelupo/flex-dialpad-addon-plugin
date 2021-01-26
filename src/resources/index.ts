import { Resource, Serverless, FlexPlugin, CheckServerless } from 'twilio-pulumi-provider';
import * as pulumi from '@pulumi/pulumi';

const stack = pulumi.getStack();

const serviceName = 'flex-dialpad-addon-serverless';
const domain = CheckServerless.getDomainName(serviceName, stack);

const { 
    FLEX_WORKSPACE_SID, 
    TASK_QUEUE_SID,
    TWILIO_NUMBER,
    VOICE_TASK_CHANNEL_SID
} = process.env;

const flexWorkspace = new Resource("flex-workspace", {
    resource: ["taskrouter", "workspaces"],
    attributes: {
        sid: FLEX_WORKSPACE_SID
    }
});

const flexDialpadAddonWorkflow = new Resource("flex-dialpad-addon-workflow", {
    resource: ["taskrouter", { "workspaces" : flexWorkspace.sid }, "workflows"],
    attributes: {
        friendlyName: 'Flex Dialpad Addon',
        configuration: JSON.stringify(
            {
                task_routing: {
                  filters: [
                    {
                      filter_friendly_name: "Agent to Agent",
                      expression: "targetWorker != null",
                      targets: [
                        {
                          queue: TASK_QUEUE_SID,
                          expression: "task.targetWorker == worker.contact_uri",
                          priority: 1000
                        }
                      ]
                    }
                  ]
                }
              }
        )
    },
});

const serverless = new Serverless("flex-dialpad-addon-functions-assets", {
    attributes: {
        cwd: `../serverless/main`,
        serviceName,
        envPath: `.${stack}.env`,
        env: {
            TWILIO_NUMBER,
            TWILIO_WORKSPACE_SID: flexWorkspace.sid,
            TWILIO_WORKFLOW_SID: flexDialpadAddonWorkflow.sid
        },
        functionsEnv: stack,
        pkgJson: require("../serverless/main/package.json")
    }
});

const flexDialpadAddonPlugin = new FlexPlugin("flex-dialpad-addon-plugin", { 
    attributes: {
        cwd: "../flex-plugins/flex-dialpad-addon",
        env: pulumi.all([domain]).apply(([ domain ]) => (
            {
                REACT_APP_SERVICE_BASE_URL: `https://${domain}`,
                REACT_APP_TASK_CHANNEL_SID: VOICE_TASK_CHANNEL_SID
            }
        ))
    }
});
 
export let output =  {
    flexWorkspaceSid: flexWorkspace.sid,
    flexDialpadAddonWorkflowSid: flexDialpadAddonWorkflow.sid,
    serverless: serverless.sid,
    flexDialpadAddonPluginSid: flexDialpadAddonPlugin.sid
}
