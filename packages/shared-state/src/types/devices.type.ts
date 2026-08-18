
// Action 请求类型
export enum ActionsRequest {
    Meshes = 'meshes', // 获取所有设备组
    Nodes = 'nodes', // 获取所有设备
}

// 获取设备组请求
export type GetDeviceGroupRequest = {
    action: ActionsRequest.Meshes;
    responseid: "req-groups"
}

// 设备组响应
export type DeviceGroupResponse = {
    action: ActionsRequest.Meshes;
    meshes: DeviceGroup[];
}

// 获取所有设备请求
export interface GetAllDevicesRequest {
    action: ActionsRequest.Nodes;
    responseid: "req-nodes";
}

// 设备响应
export interface DeviceResponse {
    action: ActionsRequest.Nodes;
    responseid: "req-nodes",
    nodes: Record<string, Device[]>; // key: groupId
}


export interface DeviceGroup {
    _id: string;
    type: string;
    name: string;
    mtype: number;
    desc: string;
    domain: string;
    links: Record<string, {
        name: string;
        rights: number;
    }>;
    creation: number;
    creatorid: string;
    creatorname: string;
}

export interface Agent {
	ver: number;
	id: number;
	caps: number;
	core: string;
	root: boolean;
}

export interface Wsc {
	antiVirus: string;
	autoUpdate: string;
	firewall: string;
}

export interface Device {
	_id: string;
	type: string;
	mtype: number;
	icon: number;
	name: string;
	rname: string;
	domain: string;
	agent: Agent;
	host: string;
	firstconnect: number;
	osdesc: string;
	ip: string;
	av: any[];
	wsc: Wsc;
	defender: Record<string, unknown>;
	users: string[];
	lusers: any[];
	lastbootuptime: number;
	conn: number;
	pwr: number;
	agct: number;
}