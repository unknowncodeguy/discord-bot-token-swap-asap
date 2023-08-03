const { getAllAccounts } = require('../services/orderService');

class UserCollection {

	constructor() {
		this.users = [];
	}

	add(uid, data) {
		this.users[uid] = data;
	}

	get(uid) {
		return this.users[uid];
	}

	exists(uid) {
		return (this.users[uid] != undefined);
	}

	async init() {
		const allRegisteredUsers = await getAllAccounts();

		for(let i = 0; i < allRegisteredUsers.length; i++) {
			this.add(
				allRegisteredUsers[i]?.discordId, 
				new User(allRegisteredUsers[i]?.discordId)
			);
			const new_user = UserCollection.get(allRegisteredUsers[i]?.discordId);
			await new_user.init();
		}
	}
}

module.exports = new UserCollection();