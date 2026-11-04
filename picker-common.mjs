export function validPortal(domain) {
    if (typeof domain !== 'string' || domain.length > 253) return false;
    const labels = domain.split('.');
    return labels.length > 1 && /^[a-z]{2,63}$/i.test(labels.at(-1)) &&
        labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

// Project onto the only fields the link builder needs. Reject rather than silently
// truncate oversized metadata, which would produce misleading search links.
export function metadataOnly(asset) {
    const string = value => {
        if (typeof value !== 'string' || value.length > 1000) throw new Error('Invalid metadata');
        return value;
    };
    if (!asset || typeof asset !== 'object') throw new Error('Invalid asset');
    const source = asset.metaproperties?.nodes ?? Object.values(asset.metaproperties ?? {});
    if (!Array.isArray(source) || source.length > 200) throw new Error('Too many fields');
    let count = 0;
    const nodes = source.map(mp => {
        if (!mp || !Array.isArray(mp.options)) throw new Error('Invalid options');
        count += mp.options.length;
        if (count > 200) throw new Error('Too many options');
        return { name: string(mp.name), options: mp.options.map(opt => ({
            name: string(typeof opt === 'string' ? opt : opt?.name)
        })) };
    });
    const tags = Array.isArray(asset.tags) ? asset.tags : Object.keys(asset.tags ?? {});
    if (tags.length > 200) throw new Error('Too many tags');
    return { name: string(asset.name ?? ''), tags: tags.map(string), metaproperties: { nodes } };
}

export function matchesMessage(event, source, origin, request) {
    return event.source === source && event.origin === origin &&
        event.data?.request === request && event.data?.channel === 'link-builder-picker';
}
