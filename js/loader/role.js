export class Role {
    constructor({ name, colorIndex, emoji }) {
        this.colorIndex = colorIndex;  // unique and immutable
        this.name = name;
        this.emoji = emoji;

        this.type = 'edit'; // edit | new | delete
        this.oldData = { name, colorIndex, emoji };
        this.newData = { name, colorIndex, emoji };
        this.dirty = false;
    }

    markDirty(type = 'edit') {
        this.type = type;
        this.dirty = true;
        SaveRegistry.add(this.colorIndex, this); // key by colorIndex
    }

    save(api) {
        saveRoleData(api, this);  // pass instance to save function
        this.dirty = false;
        SaveRegistry.remove(this.colorIndex);
    }

    update(newValues) {
        this.newData = { ...this.newData, ...newValues };
        Object.assign(this, newValues); // update current state
        this.markDirty('edit');
    }
}
