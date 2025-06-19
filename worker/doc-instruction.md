# Sample request body

The Meraki Dashboard will send a webhook like this to the PowerBuddy
webhook endpoint:

## One of my devices detected on the network

```
{
  "version": "0.1",
  "sharedSecret": "",
  "sentAt": "2025-06-19T05:46:40.258344Z",
  "organizationId": "798994",
  "organizationName": "Moos @ Meraki",
  "organizationUrl": "https://n459.meraki.com/o/vgV8Dc/manage/organization/overview",
  "networkId": "L_647955396387934188",
  "networkName": "Nathan Apt",
  "networkUrl": "https://n459.meraki.com/Nathan-Apt-appli/n/TGeB_bxc/manage/nodes/wired_status",
  "networkTags": [],
  "deviceSerial": "Q2YN-6MFF-Y6GJ",
  "deviceMac": "cc:9c:3e:51:20:41",
  "deviceName": "Home",
  "deviceUrl": "https://n459.meraki.com/Nathan-Apt-appli/n/TGeB_bxc/manage/nodes/new_wired_status",
  "deviceTags": [],
  "deviceModel": "MX85",
  "alertId": "",
  "alertType": "Client connectivity changed",
  "alertTypeId": "client_connectivity",
  "alertLevel": "warning",
  "occurredAt": "2025-06-19T05:46:40.222636Z",
  "alertData": {
    "mac": "00:11:22:33:44:55",
    "ip": "192.168.1.2",
    "connected": "true",
    "clientName": "Cisco Meraki valued client",
    "clientUrl": "https://n459.meraki.com/Nathan-Apt-appli/n/TGeB_bxc/manage/usage/list#c=k909b4b"
  }
}
```

The client names we're most interested in are...

* `asimov`
* `bazzite`
* `bluefin`
* `Android_CBT1NIVD`

The Durable Object should have the connected state forwarded to it.