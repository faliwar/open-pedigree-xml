import Raphael from 'raphael';

/**
 * Joins all the subsets into one set and returns it.
 * @return {Raphael.st}
 */
Raphael.st.flatten = function () {
    var flattenedSet = new Raphael.st.constructor();
        this.forEach(function(element) {
            flattenedSet = flattenedSet.concat(element.flatten());
        });
    return flattenedSet;
};

/**
 * Returns set containing the given element
 * @return {Raphael.st}
 */
Raphael.el.flatten = function () {
    return this.paper.set(this);
};

/**
 * Returns a set containing the elements of this set and the given set. Doesn't modify the original sets.
 * @param {Raphael.st} set
 * @return {Raphael.st}
 */
Raphael.st.concat = function (set) {
    var newSet = this.copy();
    if(typeof(set.forEach) == 'function') {
        set.forEach(function(element) {
            newSet.push(element);
        });
    }
    else {
        newSet.push(set);
    }
    return newSet;
};

/**
 * Returns True if this set contains target. Target has to be directly in this set, and not in a subset.
 *
 * @param {Raphael.st|Raphael.el} target
 * @return {boolean}
 */
Raphael.st.contains = function (target) {
    var found = false;
    this.forEach(function(element) {
        if(element == target) {
            found = true;
        }
    });
    return found;
};

/**
 * Returns a new set containing the same elements as this set
 * @return {Raphael.st}
 */
Raphael.st.copy = function() {
    var newSet = new Raphael.st.constructor();
    this.forEach(function(element) {
        newSet.push(element);
    });
    return newSet;
};

/**
 * Inserts all elements of this set before the given target element or set
 * @param {Raphael.el|Raphael.st} target
 * @return {Raphael.st}
 */
Raphael.st.insertBefore = function(target) {
    if (!target) return this;
    var ref = (target.constructor === Raphael.st.constructor || target.type === 'set') ? target[0] : target;
    for (var i = 0, ii = this.items.length; i < ii; i++) {
        if (this.items[i] && typeof this.items[i].insertBefore === 'function') {
            this.items[i].insertBefore(ref);
        }
    }
    return this;
};

export default Raphael;
