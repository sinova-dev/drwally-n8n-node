import type { ICredentialTestRequest, ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class DrWallyPrivateApi implements ICredentialType {
	name = 'drwallyPrivateApi';

	displayName = 'DrWally Private API';

	icon: Icon = {
		light: 'file:../icons/Drwally.light.svg',
		dark: 'file:../icons/Drwally.dark.svg',
	};

	documentationUrl = 'https://api.drwallyai.com/api#/Webhooks';

	properties: INodeProperties[] = [
		{
			displayName: 'API Link',
			name: 'apiLink',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Secret key',
			name: 'secretKey',
			type: 'string',
			default: '',
			typeOptions: { password: true },
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.apiLink}}/health',
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-API-KEY': '={{$credentials?.secretKey}}',
			},
		},
	};
}
