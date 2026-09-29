import { YouTubeEmailExtractor } from './nodes/YouTubeEmailExtractor/YouTubeEmailExtractor.node';
import { ApifyApi } from './credentials/ApifyApi.credentials';

export const nodeTypes = [YouTubeEmailExtractor];

export const credentialTypes = [ApifyApi];
