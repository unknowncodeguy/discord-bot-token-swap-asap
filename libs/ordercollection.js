const { getAllOrders } = require('../services/orderService');

class OrderCollection {

	constructor() {
		this.orderList = {};
	}

	async init() {
		try {
			const orderData = await getAllOrders();
			console.log(`orderData is ${orderData?.length}`);

			for(let i = 0; i < orderData?.length; i++) {
				const discordId = orderData[i]?.discordId;
				if(discordId) {
					this.orderList[discordId] = new Array();
					this.orderList[discordId].push({
						_id: orderData[i]._id.toString(),
						tokenAddress: orderData[i]?.tokenAddress,
						mentionedPrice: orderData[i]?.mentionedPrice,
						purchaseAmount: orderData[i]?.purchaseAmount,
						slippagePercentage: orderData[i]?.slippagePercentage,
						isBuy: orderData[i]?.isBuy,
						isFinished: orderData[i]?.isFinished
					});
				}
			}
		}
		catch(err) {
			conosle.log(`When getting all orders from DB and set it to order collection: ${err}`);
		}
	}

	async setOrder (_id, discordId, tokenAddress, mentionedPrice, purchaseAmount, slippagePercentage, isBuy) {
		try {
			if(!this.orderList[discordId]) {
				this.orderList[discordId] = new Array();
			}
			this.orderList[discordId].push({
				_id: _id.toString(),
				tokenAddress,
				mentionedPrice,
				purchaseAmount,
				slippagePercentage,
				isBuy,
				isFinished: false	
			});
		}
		catch(err) {
			conosle.log(`When set order to order collection: ${err}`);
		}
    }

    async getOrders (discordId, tokenAddress = ``) {
        try{
			if(tokenAddress === '') {
				return this.orderList[discordId];
			}

			return this.orderList[discordId].filter(order => order.tokenAddress === tokenAddress);
        }
        catch(err) {
            console.log(`Error when getting order data from order collection: ${err}`);
        }

        return [];
    }

    async getOrderList (tokenAddress) {
        try{
			let orderListByToken = [];
			const userDiscordIds = Object.keys(this.orderList);

			for(let i = 0; i < userDiscordIds?.length; i++) {
				const orderListByUserId = this.orderList[userDiscordIds[i]];
				for(let j = 0; j < orderListByUserId.length; j++) {
					const order = orderListByUserId[j];
					if(order.tokenAddress === tokenAddress) {
                        orderListByToken.push({...order, discordId: userDiscordIds[i]});
                    }
				}
			}

			return orderListByToken;
        }
        catch(err) {
            console.log(`Error when getOrderList from order colletion: ${err}`);
        }

        return [];
    }

    async deleteOrder (_id) {
		let result = false;

        try{
			const userDiscordIds = Object.keys(this.orderList);

			for(let i = 0; i < userDiscordIds?.length; i++) {
				const orderListByUserId = this.orderList[userDiscordIds[i]];
				for(let j = 0; j < orderListByUserId.length; j++) {
					const order = orderListByUserId[j];

					if(order._id.toString() === _id.toString()) {
						this.orderList[userDiscordIds[i]].splice(j, 1);
						result = true;
					}
				}
			}
        }
        catch(err) {
            console.log(`Error deleteOrder from order collection: ${err}`);
        }

        return result;
    }

    async orderExecuted (_id) {
		let result = false;

        try{
			const userDiscordIds = Object.keys(this.orderList);

			for(let i = 0; i < userDiscordIds?.length; i++) {
				const orderListByUserId = this.orderList[userDiscordIds[i]];
				for(let j = 0; j < orderListByUserId.length; j++) {
					const order = orderListByUserId[j];

					if(order._id.toString() === _id.toString()) {
						this.orderList[userDiscordIds[i]][j] = {
							...order,
							isFinished: true
						}
						result = true;
					}
				}
			}
        }
        catch(err) {
            console.log(`Error deleteOrder from order collection: ${err}`);
        }

        return result;
    }

    async getOrderById (_id) {
		let result = null;

        try{
			const userDiscordIds = Object.keys(this.orderList);

			for(let i = 0; i < userDiscordIds?.length; i++) {
				if(result) {
					break;
				}
				const orderListByUserId = this.orderList[userDiscordIds[i]];
				for(let j = 0; j < orderListByUserId.length; j++) {
					const order = orderListByUserId[j];

					if(order._id.toString() === _id.toString()) {
						result = order;
						break;
					}
				}
			}
        }
        catch(err) {
            console.log(`Error deleteOrder from order collection: ${err}`);
        }

        return result;
    }
}

module.exports = new OrderCollection();