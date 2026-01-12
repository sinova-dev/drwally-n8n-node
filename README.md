# n8n-nodes-DrWally

This is an n8n community node. It lets you use DrWally API in your n8n workflows.

DrWally API is service that allows users automate whatsapp messaging for business purposes.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)
[Compatibility](#compatibility)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

1. Send private message - send message to a single user
2. Send group message - send message to a group

## Credentials

For sending messages using DrWally node, you need to have account on [DrWally website](https://drwallyai.com/)

1. Create account.
2. Log in.
3. In sidebar select WhatsApp for Business
4. Connect your whatsapp account to the app.
5. Select Webhooks for WhatsApp for Business on sidebar
6. Generate webhook for selected phone number
7. Use Webhook URL and Secret Key, to create credentials in n8n.

## Compatibility

Minimum n8n version - 2.1.5

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [DrWally API](https://api.drwallyai.com/api-public)
