import { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
import {
	CREDENTIAL_DRWALLY_GROUP_API,
	API_DOCUMENTATION_URL,
	API_HEALTH_PATH,
} from '../constants/misc';

export class DrWallyGroupApi implements ICredentialType {
	name = CREDENTIAL_DRWALLY_GROUP_API;

	displayName = 'DrWally Group API';

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
			displayName: 'Secret key',
			name: 'secretKey',
			type: 'string',
			default: '',
			typeOptions: { password: true },
			required: true,
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.webhookUrl}}' + API_HEALTH_PATH,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-API-KEY': '={{$credentials?.secretKey}}',
			},
		},
	};
}
