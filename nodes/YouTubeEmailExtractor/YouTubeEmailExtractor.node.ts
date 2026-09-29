import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import type { OptionField } from './GenericFunctions';
import { applyOptions, requireList, runActorAndGetItems } from './GenericFunctions';

// ScrapeUnblocker's public "YouTube Email Extractor" Actor: https://apify.com/scrapeunblocker/youtube-email-extractor
const ACTOR_ID = 'imHbRSMYUqobbG5Hr';
const INTEGRATION_APP_ID = 'scrapeunblocker-youtube-email-extractor';

// Node option name -> Actor input key.
const OPTION_FIELDS: Record<string, OptionField> = {
	concurrency: {
		key: 'concurrency',
	},
};

function buildActorInput(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	options: IDataObject,
	itemIndex: number,
): IDataObject {
	const input: IDataObject = {};

	switch (`${resource}:${operation}`) {
		case 'channelEmail:get': {
			input.channels = requireList.call(this, 'channels', 'Channels', itemIndex);
			break;
		}
		default:
			throw new NodeOperationError(
				this.getNode(),
				`The operation "${operation}" is not supported for resource "${resource}"`,
				{ itemIndex },
			);
	}

	applyOptions(input, options, OPTION_FIELDS);
	return input;
}

export class YouTubeEmailExtractor implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'YouTube Email Extractor',
		name: 'youTubeEmailExtractor',
		icon: {
			light: 'file:youTubeEmailExtractor.png',
			dark: 'file:youTubeEmailExtractor.dark.png',
		},
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Find the public contact email of YouTube channels with the ScrapeUnblocker Actor on Apify',
		defaults: {
			name: 'YouTube Email Extractor',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'apifyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Channel Email',
						value: 'channelEmail',
					},
				],
				default: 'channelEmail',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['channelEmail'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get the public contact email of YouTube channels',
						action: 'Get channel emails',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Channels',
				name: 'channels',
				type: 'string',
				required: true,
				default: '',
				placeholder: '@mkbhd, https://www.youtube.com/@LinusTechTips',
				description:
					'YouTube channels to look up: handles (@mkbhd), channel IDs (UC...) or channel URLs',
				displayOptions: {
					show: {
						resource: ['channelEmail'],
						operation: ['get'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Concurrency',
						name: 'concurrency',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 8,
						},
						default: 3,
						description: 'How many channels to look up in parallel (1-8)',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 0,
						description:
							'Maximum run time of the Apify Actor run. 0 keeps the Actor default. A run that times out fails the node.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const { timeout, ...actorOptions } = options;

				const input = buildActorInput.call(this, resource, operation, actorOptions, i);
				const { items: results } = await runActorAndGetItems.call(this, {
					actorId: ACTOR_ID,
					integrationAppId: INTEGRATION_APP_ID,
					input,
					itemIndex: i,
					timeoutSecs: (timeout as number) || undefined,
				});

				for (const result of results) {
					returnData.push({ json: result, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors return an error of their own class unchanged.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
