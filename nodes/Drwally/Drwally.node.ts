import type {
	ICredentialData,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	PARAM_OPERATION,
	PARAM_RECIPIENT,
	PARAM_MESSAGE,
	PARAM_API_LINK,
	PARAM_SECRET_KEY,
	RESPONSE_STATUS_QUEUED,
	OPERATION_SEND_PRIVATE,
	OPERATION_SEND_GROUP,
	ERROR_FAILED_GET_PRIVATE_CREDENTIALS,
	ERROR_FAILED_GET_GROUP_CREDENTIALS,
	ERROR_UNKNOWN_OPERATION,
	ERROR_NO_CREDENTIALS_FOUND,
	ERROR_API_LINK_REQUIRED,
	ERROR_SECRET_KEY_REQUIRED,
	ERROR_FAILED_SEND_MESSAGE,
	CREDENTIAL_DRWALLY_PRIVATE_API,
	CREDENTIAL_DRWALLY_GROUP_API,
	SEND_PRIVATE,
	SEND_GROUP,
} from '../../constants/misc';

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
				name: CREDENTIAL_DRWALLY_PRIVATE_API,
				displayName: 'Private Message Credentials',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_PRIVATE],
					},
				},
			},
			{
				name: CREDENTIAL_DRWALLY_GROUP_API,
				displayName: 'Group Message Credentials',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_GROUP],
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
						operation: [SEND_PRIVATE, SEND_GROUP],
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
						operation: [SEND_PRIVATE, SEND_GROUP],
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
				const operation = this.getNodeParameter(PARAM_OPERATION, itemIndex) as string;
				const recipient = this.getNodeParameter(PARAM_RECIPIENT, itemIndex, '') as string;
				const message = this.getNodeParameter(PARAM_MESSAGE, itemIndex, '') as string;
				let credentials: ICredentialData;

				switch (operation) {
					case OPERATION_SEND_PRIVATE:
						try {
							credentials = await this.getCredentials(CREDENTIAL_DRWALLY_PRIVATE_API);
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								new Error(ERROR_FAILED_GET_PRIVATE_CREDENTIALS + error),
								{
									itemIndex,
								},
							);
						}
						break;

					case OPERATION_SEND_GROUP:
						try {
							credentials = await this.getCredentials(CREDENTIAL_DRWALLY_GROUP_API);
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								new Error(ERROR_FAILED_GET_GROUP_CREDENTIALS + error),
								{
									itemIndex,
								},
							);
						}
						break;

					default:
						throw new NodeOperationError(
							this.getNode(),
							new Error(`${ERROR_UNKNOWN_OPERATION}${operation}`),
							{
								itemIndex,
							},
						);
				}

				if (
					!credentials ||
					!(PARAM_API_LINK in credentials) ||
					!(PARAM_SECRET_KEY in credentials)
				) {
					throw new NodeOperationError(this.getNode(), new Error(ERROR_NO_CREDENTIALS_FOUND), {
						itemIndex,
					});
				}

				if (credentials.apiLink === '') {
					throw new NodeOperationError(this.getNode(), new Error(ERROR_API_LINK_REQUIRED), {
						itemIndex,
					});
				}
				if (credentials.secretKey === '') {
					throw new NodeOperationError(this.getNode(), new Error(ERROR_SECRET_KEY_REQUIRED), {
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

				if (!response.status || response.status !== RESPONSE_STATUS_QUEUED) {
					throw new NodeOperationError(
						this.getNode(),
						new Error(`${ERROR_FAILED_SEND_MESSAGE}${response.status}`),
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
