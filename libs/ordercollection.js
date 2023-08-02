const { getAllOrders } = require('../services/orderService');

class OrderCollection {

	constructor() {
		this.orderList = {};
	}

	async init() {
		const orderData = await getAllOrders();
		console.log(`orderData is ${orderData?.length}`);

		for(let i = 0; i < orderData?.length; i++) {
			const discordId = orderData[i]?.discordId;
			if(discordId) {
				this.orderList[discordId].push();
			}
		}
	}
}

module.exports = new OrderCollection();