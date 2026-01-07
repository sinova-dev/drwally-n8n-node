import type {
	ICredentialData,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Drwally implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DrWally',
		name: 'drwally',
		icon: {
			light: 'file:../../icons/Drwally.light.svg',
			dark: 'file:../../icons/Drwally.dark.svg',
		},
		group: ['input'],
		version: 1,
		description: 'DrWally send message node',
		defaults: {
			name: 'DrWally',
		},
		credentials: [
			{
				name: 'drwallyPrivateApi',
				displayName: 'Private Message Credentials',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendPrivate'],
					},
				},
			},
			{
				name: 'drwallyGroupApi',
				displayName: 'Group Message Credentials',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendGroup'],
					},
				},
			},
		],
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Message',
						value: 'message',
					},
				],
				default: 'message',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Send Private Message',
						value: 'sendPrivate',
						description: 'Send a private message',
						action: 'Send a private message',
					},
					{
						name: 'Send Group Message',
						value: 'sendGroup',
						description: 'Send a group message',
						action: 'Send a group message',
					},
				],
				default: 'sendPrivate',
			},
			{
				displayName: 'Recipient',
				name: 'recipient',
				type: 'string',
				default: '',
				placeholder: 'Enter recipient phone number / group name',
				description: 'The recipient phone number',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendPrivate', 'sendGroup'],
					},
				},
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: '',
				placeholder: 'Enter message',
				description: 'The message to send',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendPrivate', 'sendGroup'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const recipient = this.getNodeParameter('recipient', itemIndex, '') as string;
				const message = this.getNodeParameter('message', itemIndex, '') as string;
				let credentials: ICredentialData;

				if (operation === 'sendPrivate') {
					try {
						credentials = await this.getCredentials('drwallyPrivateApi');
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							new Error('Failed to get private credentials: ' + error),
							{
								itemIndex,
							},
						);
					}
				} else if (operation === 'sendGroup') {
					try {
						credentials = await this.getCredentials('drwallyGroupApi');
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							new Error('Failed to get group credentials: ' + error),
							{
								itemIndex,
							},
						);
					}
				} else {
					throw new NodeOperationError(
						this.getNode(),
						new Error(`Unknown operation: ${operation}`),
						{
							itemIndex,
						},
					);
				}

				if (!credentials || !('apiLink' in credentials) || !('secretKey' in credentials)) {
					throw new NodeOperationError(this.getNode(), new Error('No credentials found'), {
						itemIndex,
					});
				}

				if (credentials.apiLink === '') {
					throw new NodeOperationError(this.getNode(), new Error('API Link is required'), {
						itemIndex,
					});
				}
				if (credentials.secretKey === '') {
					throw new NodeOperationError(this.getNode(), new Error('Secret Key is required'), {
						itemIndex,
					});
				}

				const apiLink = credentials.apiLink;
				const secretKey = credentials.secretKey;

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `${apiLink}`,
					headers: {
						'Content-Type': 'application/json',
						'X-API-KEY': secretKey as string,
					},
					body: {
						recipient,
						message,
					},
					json: true,
				};

				const response = await this.helpers.httpRequest(options);

				if (!response.status || response.status !== 'queued') {
					throw new NodeOperationError(
						this.getNode(),
						new Error(`Failed to send message: ${response.status}`),
						{
							itemIndex,
						},
					);
				}

				returnData.push({
					json: response,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					const originalItem = items[itemIndex] || { json: {} };
					const errorMessage = error instanceof Error ? error.message : String(error);

					returnData.push({
						json: {
							...originalItem.json,
							error: errorMessage,
						},
						pairedItem: { item: itemIndex },
					});
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
