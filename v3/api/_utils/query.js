
module.exports = {
  graphqlArgToQueryParam(grapqlArgs) {
    const res = {}

    for(var arg of grapqlArgs) {
      for (var key of Object.keys(arg)) {
        switch (key) {
          case 'limit':
            res._limit = parseInt(arg[key].value, 10);
            break;
          case 'start':
            res._start = parseInt(arg[key].value, 10);
            break;
          case 'where':
            res._where = arg[key].value;
            break;
          case 'sort':
            res._sort = arg[key].value;
            break;
            
          default:
        };
      }
    }
    
    return res;
  },
  queryBuilder(model, params) {
    // console.debug('queryBuilder params', params);
    const limit = params._limit || 100
    const start = parseInt(params._start, 10) || 0

    return model.query((qb) => {
      // qb.debug(true);
      for (let field in params._where) {
        const value = params._where[field]
        // console.log("cond", field, value);
        const lastPos = field.lastIndexOf('_');
        const justField = lastPos >= 0 ? field.substr(0, lastPos) : field;
        if (field.endsWith('_ne')) {
          field = field.substr(0, field.length - 3);
          if (value == 'null') {
            qb.where(field, 'is not', null);
          } else {
            qb.where(field, '<>', value);
          }
        } else if (field.endsWith('_lt')) {
          qb.where(justField, '<', value);
        } else if (field.endsWith('_gt')) {
          qb.where(justField, '>', value);
        } else if (field.endsWith('_lte')) {
          qb.where(justField, '<=', value);
        } else if (field.endsWith('_gte')) {
          qb.where(justField, '>=', value);
        } else if (field.endsWith('_in')) {
          qb.where(justField, 'in', value);
        } else if (field.endsWith('_nin')) {
          qb.where(justField, 'not in', value);
        } else if (field.endsWith('_contains')) {
          qb.where(justField, 'like', '%' + value + '%');
        } else if (field.endsWith('_ncontains')) {
          qb.where(justField, 'not like', '%' + value + '%');
        } else if (field.endsWith('_containss')) {
          //TODO permission denied
          qb.where(justField, 'like binary', '%' + value + '%');
        } else if (field.endsWith('_ncontainss')) {
          //TODO permission denid
          qb.where(justField, 'not like binary', '%' + value + '%');
        } else if (field.endsWith('_null')) {
          qb.where(justField, 'is null');
        } else if (field.endsWith('_eq')) {
          qb.where(justField, '=', value);
        }
        else {
          qb.where(field, '=', value);
        }
      }

      if (params._sort) {
        const [sortField, sortDir] = params._sort.split(':');
        // console.debug('sort?', sortField, sortDir);
        if (sortDir) {
          qb.orderBy(sortField, sortDir);
        } else {
          qb.orderBy(sortField, 'asc');
        }
      }

      qb.limit(limit);
      qb.offset(start);
    });
  }

}