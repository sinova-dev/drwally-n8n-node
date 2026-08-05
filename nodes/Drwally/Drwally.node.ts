import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { ApplicationError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	PARAM_OPERATION,
	PARAM_RECIPIENT,
	PARAM_MESSAGE,
	PARAM_TEMPLATE,
	PARAM_INCLUDE_CONTEXT,
	PARAM_CONTEXT_MODE,
	PARAM_CONTEXT_FIELDS,
	PARAM_CONTEXT,
	PARAM_WEBHOOK_URL,
	PARAM_SECRET_KEY,
	RESPONSE_STATUS_QUEUED,
	OPERATION_SEND_PRIVATE,
	OPERATION_SEND_GROUP,
	OPERATION_SEND_TEMPLATE,
	ERROR_FAILED_GET_PRIVATE_CREDENTIALS,
	ERROR_FAILED_GET_GROUP_CREDENTIALS,
	ERROR_FAILED_GET_TEMPLATE_CREDENTIALS,
	ERROR_UNKNOWN_OPERATION,
	ERROR_NO_CREDENTIALS_FOUND,
	ERROR_API_LINK_REQUIRED,
	ERROR_SECRET_KEY_REQUIRED,
	ERROR_FAILED_SEND_MESSAGE,
	ERROR_FAILED_FETCH_TEMPLATES,
	ERROR_NO_TEMPLATES_FOUND,
	ERROR_INVALID_TEMPLATE,
	ERROR_INVALID_CONTEXT,
	CREDENTIAL_DRWALLY_PRIVATE_MESSAGE_API,
	CREDENTIAL_DRWALLY_GROUP_MESSAGE_API,
	CREDENTIAL_DRWALLY_TEMPLATE_MESSAGE_API,
	CONTEXT_MODE_FIELDS,
	CONTEXT_MODE_JSON,
	SEND_PRIVATE,
	SEND_GROUP,
	SEND_TEMPLATE,
	API_DATA_PATH,
	LOAD_OPTIONS_GET_TEMPLATES,
} from '../../constants/misc';

type TemplateItem = {
	id: string;
	name: string;
	language: string;
	status: string;
};

type TemplateSelection = {
	name: string;
	language: string;
};

function normalizeWebhookUrl(webhookUrl: string): string {
	return webhookUrl.replace(/\/+$/, '');
}

function extractTemplates(response: unknown): TemplateItem[] {
	if (!response || typeof response !== 'object') {
		return [];
	}

	const payload = response as Record<string, unknown>;

	if (!Array.isArray(payload.data)) {
		return [];
	}

	const templates: TemplateItem[] = [];

	for (const item of payload.data) {
		if (!item || typeof item !== 'object') {
			continue;
		}

		const template = item as Record<string, unknown>;
		const name = typeof template.name === 'string' ? template.name : '';
		const language = typeof template.language === 'string' ? template.language : '';

		if (!name || !language) {
			continue;
		}

		templates.push({
			id: typeof template.id === 'string' ? template.id : String(template.id ?? ''),
			name,
			language,
			status: typeof template.status === 'string' ? template.status : '',
		});
	}

	return templates;
}

function parseTemplateSelection(value: unknown): TemplateSelection {
	const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;

	if (!parsed || typeof parsed !== 'object') {
		throw new ApplicationError(ERROR_INVALID_TEMPLATE);
	}

	const template = parsed as Record<string, unknown>;
	const name = typeof template.name === 'string' ? template.name : '';
	const language = typeof template.language === 'string' ? template.language : '';

	if (!name || !language) {
		throw new ApplicationError(ERROR_INVALID_TEMPLATE);
	}

	return { name, language };
}

function parseContext(value: unknown): unknown {
	if (typeof value !== 'string') {
		return value;
	}

	return JSON.parse(value);
}

function parseContextFields(value: unknown): IDataObject {
	if (!value || typeof value !== 'object') {
		return {};
	}

	const collection = value as { field?: Array<{ name?: string; value?: string }> };
	const fields = Array.isArray(collection.field) ? collection.field : [];

	const context: IDataObject = {};

	for (const field of fields) {
		if (!field || typeof field.name !== 'string' || field.name === '') {
			continue;
		}

		context[field.name] = field.value ?? '';
	}

	return context;
}

function getCredentialTypeForOperation(operation: string): string {
	switch (operation) {
		case OPERATION_SEND_PRIVATE:
			return CREDENTIAL_DRWALLY_PRIVATE_MESSAGE_API;
		case OPERATION_SEND_GROUP:
			return CREDENTIAL_DRWALLY_GROUP_MESSAGE_API;
		case OPERATION_SEND_TEMPLATE:
			return CREDENTIAL_DRWALLY_TEMPLATE_MESSAGE_API;
		default:
			throw new ApplicationError(`${ERROR_UNKNOWN_OPERATION}${operation}`);
	}
}

function getCredentialErrorPrefix(operation: string): string {
	switch (operation) {
		case OPERATION_SEND_PRIVATE:
			return ERROR_FAILED_GET_PRIVATE_CREDENTIALS;
		case OPERATION_SEND_GROUP:
			return ERROR_FAILED_GET_GROUP_CREDENTIALS;
		case OPERATION_SEND_TEMPLATE:
			return ERROR_FAILED_GET_TEMPLATE_CREDENTIALS;
		default:
			return ERROR_UNKNOWN_OPERATION;
	}
}

function assertWebhookCredentials(credentials: IDataObject): string {
	if (!(PARAM_WEBHOOK_URL in credentials) || !(PARAM_SECRET_KEY in credentials)) {
		throw new ApplicationError(ERROR_NO_CREDENTIALS_FOUND);
	}

	if (credentials[PARAM_WEBHOOK_URL] === '') {
		throw new ApplicationError(ERROR_API_LINK_REQUIRED);
	}

	if (credentials[PARAM_SECRET_KEY] === '') {
		throw new ApplicationError(ERROR_SECRET_KEY_REQUIRED);
	}

	return normalizeWebhookUrl(credentials[PARAM_WEBHOOK_URL] as string);
}

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
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'DrWally send message node',
		defaults: {
			name: 'DrWally',
		},
		credentials: [
			{
				name: CREDENTIAL_DRWALLY_PRIVATE_MESSAGE_API,
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
				name: CREDENTIAL_DRWALLY_GROUP_MESSAGE_API,
				displayName: 'Group Message Credentials',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_GROUP],
					},
				},
			},
			{
				name: CREDENTIAL_DRWALLY_TEMPLATE_MESSAGE_API,
				displayName: 'Template Message Credentials',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_TEMPLATE],
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
					{
						name: 'Send Template Message',
						value: 'sendTemplate',
						description: 'Send a template message',
						action: 'Send a template message',
					},
				],
				default: 'sendPrivate',
			},
			{
				displayName: 'Recipient',
				name: 'recipient',
				type: 'string',
				default: '',
				placeholder: 'e.g. +15551234567',
				description: 'The recipient phone number, or the group name for group messages',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_PRIVATE, SEND_GROUP, SEND_TEMPLATE],
					},
				},
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: '',
				placeholder: 'e.g. Hello, thanks for reaching out!',
				description: 'The message to send',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_PRIVATE, SEND_GROUP],
					},
				},
			},
			{
				displayName: 'Template',
				name: 'template',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: LOAD_OPTIONS_GET_TEMPLATES,
				},
				default: '',
				description: 'This is fetched from your approved templates in DrWally dashboard',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_TEMPLATE],
					},
				},
			},
			{
				displayName: 'Include Context',
				name: 'includeContext',
				type: 'boolean',
				default: false,
				description: 'Whether to include context to fill variables in your message',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_TEMPLATE],
					},
				},
			},
			{
				displayName: 'Specify Context',
				name: 'contextMode',
				type: 'options',
				options: [
					{
						name: 'JSON Fields',
						value: CONTEXT_MODE_FIELDS,
					},
					{
						name: 'Raw JSON',
						value: CONTEXT_MODE_JSON,
					},
				],
				default: CONTEXT_MODE_FIELDS,
				description: 'Whether to build the context from name/value pairs or provide raw JSON',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_TEMPLATE],
						includeContext: [true],
					},
				},
			},
			{
				displayName: 'Fields',
				name: 'contextFields',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_TEMPLATE],
						includeContext: [true],
						contextMode: [CONTEXT_MODE_FIELDS],
					},
				},
				options: [
					{
						name: 'field',
						displayName: 'Field',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								placeholder: 'e.g. customerName',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: 'e.g. John Smith',
							},
						],
					},
				],
			},
			{
				displayName: 'Context',
				name: 'context',
				type: 'json',
				default: '{}',
				description: 'Optional context payload sent next to template',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: [SEND_TEMPLATE],
						includeContext: [true],
						contextMode: [CONTEXT_MODE_JSON],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				let credentials: IDataObject;

				try {
					credentials = await this.getCredentials(CREDENTIAL_DRWALLY_TEMPLATE_MESSAGE_API);
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						new Error(ERROR_FAILED_GET_TEMPLATE_CREDENTIALS + error),
					);
				}

				let webhookUrl: string;

				try {
					webhookUrl = assertWebhookCredentials(credentials);
				} catch (error) {
					throw new NodeOperationError(this.getNode(), error);
				}

				let response: unknown;

				try {
					const options: IHttpRequestOptions = {
						method: 'GET',
						url: `${webhookUrl}${API_DATA_PATH}`,
						headers: {
							'Content-Type': 'application/json',
						},
						json: true,
					};

					response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						CREDENTIAL_DRWALLY_TEMPLATE_MESSAGE_API,
						options,
					);
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						new Error(ERROR_FAILED_FETCH_TEMPLATES + error),
					);
				}

				const templates = extractTemplates(response);

				if (templates.length === 0) {
					throw new NodeOperationError(this.getNode(), new Error(ERROR_NO_TEMPLATES_FOUND));
				}

				return templates.map((template) => ({
					name: template.status
						? `${template.name} (${template.language}) [${template.status}]`
						: `${template.name} (${template.language})`,
					value: JSON.stringify({
						name: template.name,
						language: template.language,
					}),
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter(PARAM_OPERATION, itemIndex) as string;
				const recipient = this.getNodeParameter(PARAM_RECIPIENT, itemIndex, '') as string;

				let credentialType: string;

				try {
					credentialType = getCredentialTypeForOperation(operation);
				} catch (error) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}

				let credentials: IDataObject;

				try {
					credentials = await this.getCredentials(credentialType);
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						new Error(getCredentialErrorPrefix(operation) + error),
						{ itemIndex },
					);
				}

				let webhookUrl: string;

				try {
					webhookUrl = assertWebhookCredentials(credentials);
				} catch (error) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}

				let body: IDataObject;

				if (operation === OPERATION_SEND_TEMPLATE) {
					const templateValue = this.getNodeParameter(PARAM_TEMPLATE, itemIndex);
					const template = parseTemplateSelection(templateValue);

					body = {
						recipient,
						template,
					};

					const includeContext = this.getNodeParameter(
						PARAM_INCLUDE_CONTEXT,
						itemIndex,
						false,
					) as boolean;

					if (includeContext) {
						try {
							const contextMode = this.getNodeParameter(
								PARAM_CONTEXT_MODE,
								itemIndex,
								CONTEXT_MODE_FIELDS,
							) as string;

							if (contextMode === CONTEXT_MODE_JSON) {
								const contextValue = this.getNodeParameter(PARAM_CONTEXT, itemIndex, {});
								body.context = parseContext(contextValue) as IDataObject;
							} else {
								const contextFieldsValue = this.getNodeParameter(
									PARAM_CONTEXT_FIELDS,
									itemIndex,
									{},
								);
								body.context = parseContextFields(contextFieldsValue);
							}
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								new Error(`${ERROR_INVALID_CONTEXT}${error}`),
								{ itemIndex },
							);
						}
					}
				} else {
					const message = this.getNodeParameter(PARAM_MESSAGE, itemIndex, '') as string;
					body = {
						recipient,
						message,
					};
				}

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: webhookUrl,
					headers: {
						'Content-Type': 'application/json',
					},
					body,
					json: true,
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					credentialType,
					options,
				);

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
					const originalJson = (items[itemIndex]?.json ?? {}) as IDataObject;
					const errorMessage = error instanceof Error ? error.message : String(error);

					returnData.push({
						json: {
							...originalJson,
							error: errorMessage,
						},
						pairedItem: { item: itemIndex },
					});
				} else {
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
