import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';
import {
	CREDENTIAL_DRWALLY_TEMPLATE_MESSAGE_API,
	API_DOCUMENTATION_URL,
	API_HEALTH_PATH,
} from '../constants/misc';

export class DrWallyTemplateMessageApi implements ICredentialType {
	name = CREDENTIAL_DRWALLY_TEMPLATE_MESSAGE_API;

	displayName = 'DrWally Template Message API';

	icon: Icon = {
		light: 'file:../icons/Drwally.light.svg',
		dark: 'file:../icons/Drwally.dark.svg',
	};

	documentationUrl = API_DOCUMENTATION_URL;

	properties: INodeProperties[] = [
		{
			displayName: 'Webhook URL',
			name: 'webhookUrl',
			type: 'string',
			default: '',
			required: true,
		},
		{
			displayName: 'Secret Key',
			name: 'secretKey',
			type: 'string',
			default: '',
			typeOptions: { password: true },
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-KEY': '={{$credentials.secretKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.webhookUrl}}',
			url: API_HEALTH_PATH,
			method: 'GET',
		},
	};
}
