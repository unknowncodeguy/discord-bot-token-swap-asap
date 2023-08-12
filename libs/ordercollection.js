const { queryOrders, createOrder, updateOrder } = require('../services/orderService');
const constants = require('./constants');
class OrderCollection {

	constructor() {
		/**
		 * this variable holds orders that are waiting for swap. 
		 * tokenAddress=>[orderData]
		 */
		this.orderList = {};
	}

	async init() {
		console.log("Initializing Limit Order List from DB....");
		try {
			const orderFilter = [
				{ key: "status", value: constants.ORDER_STATUS.WAITING }
			]
			const orderDetails = await queryOrders(orderFilter);

			console.log(`Loaded ${orderDetails?.length} orders to swap`);

			for (let i = 0; i < orderDetails?.length; i++) {
				const token_addr = orderDetails[i]?.tokenAddress;
				if (token_addr) {
					if (!Array.isArray(this.orderList[token_addr]))
						this.orderList[token_addr] = new Array();
					this.orderList[token_addr].push(orderDetails[i]);
				}
			}
		}
		catch (err) {
			console.log(`OrderCollection initialization get failed : ${err}`);
		}

		console.log("Limit Order List is initialized from DB.");
	}

	async createOrder(discordId, tokenAddress, mentionedPrice, purchaseAmount, slippagePercentage, isBuy) {
		try {
			const res = await createOrder(discordId, tokenAddress, mentionedPrice, Number(purchaseAmount), Number(slippagePercentage), isBuy);
			if (res) {
				if (!this.orderList[tokenAddress]) {
					this.orderList[tokenAddress] = new Array();
				}
				this.orderList[tokenAddress].push(res);
				return res;
			}
		}
		catch (err) {
			console.log(`CreateOrder get failed for user(${discordId}), token(${tokenAddress}): ${err}`);
		}
		return null;
	}

	getOrderDataByID(tokenAddr, orderId)
	{
		console.log(`getOrderDataByID (${tokenAddr}, ${orderId})`);
		const order_data = this.orderList[tokenAddr].find(order => order._id.toString() == orderId);
		console.log(`getOrderDataByID result : (${JSON.stringify(order_data)})`);
		return order_data;
	}
	//async getOrderList(tokenAddress) {
	async getWaitingOrdersByTokenaddress(tokenAddress) {
		return this.orderList[tokenAddress];
	}
	async getOrdersByStatus(discordID, status) {
		const orderFilter = [
			{ key: "discordId", value: discordID },
			{ key: "status", value: status }
		]
		const orderDetails = await queryOrders(orderFilter);
		return orderDetails;
	}
	async getWaitingOrdersByUser(discordID, tokenAddress) {
		const orderFilter = [
			{ key: "discordId", value: discordID },
			{ key: "status", value: constants.ORDER_STATUS.WAITING },
			{ key: "tokenAddress", value: tokenAddress }
		]
		const orderDetails = await queryOrders(orderFilter);
		return orderDetails;
	}

	async processOrder(_id, token_addr) {
		if (!this.orderList[token_addr]) {

			return false;
		}
		if(this.getOrderDataByID(token_addr, _id).status > constants.ORDER_STATUS.WAITING) return false;
		
		this.orderList[token_addr] = this.orderList[token_addr].filter(order => order._id.toString() != _id);
		await updateOrder(_id, constants.ORDER_STATUS.PENDING, "");
	}
	async cancelOrder(_id) {

		const orderFilter = [
			{ key: "_id", value: _id }
		]
		const orderDetails = await queryOrders(orderFilter);
		if(orderDetails && Array.isArray(orderDetails) && orderDetails.length > 0)
		{
			const canceled_order = orderDetails[0];
			if(canceled_order.status != constants.ORDER_STATUS.WAITING)
				{
					console.log(`This order(${_id}) is already processed, user can't cancel it.`);
					return canceled_order;
				}
			this.orderList[canceled_order.tokenAddress] = this.orderList[canceled_order.tokenAddress].filter(order => order._id.toString() != _id);
			await updateOrder(_id, constants.ORDER_STATUS.CANCELED, "User canceled.");
			return canceled_order;	
		}
		return null;
	}
	async closeOrder(_id, status, result) {
		
		await updateOrder(_id, status, result);
	}
	
}

module.exports = OrderCollection;